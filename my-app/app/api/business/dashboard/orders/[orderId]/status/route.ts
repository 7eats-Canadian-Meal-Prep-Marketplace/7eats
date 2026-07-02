import { createHash, randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import {
  authUser,
  cookProfiles,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import { formatPickupLocation } from "@/lib/address";
import { isArrivalWithinWindow } from "@/lib/delivery/arrival";
import {
  sendOrderCancelledByCookEmailToClient,
  sendOrderConfirmedEmailToClient,
  sendOrderNotReadyEmailToClient,
  sendOrderReadyEmailToClient,
} from "@/lib/emails/order-events";
import { findUncollectiblePayment } from "@/lib/orders/fulfillment-readiness";
import { canMarkReady } from "@/lib/orders/readiness";
import { settleCookSubsidy } from "@/lib/orders/settle-subsidy";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  refundPaymentIntent,
} from "@/lib/stripe/payments";

export type Params = { params: Promise<{ orderId: string }> };

const orderIdSchema = z.uuid();

const bodySchema = z.object({
  status: z.enum(["confirmed", "ready", "cancelled"]),
  reason: z.enum(["client_no_show"]).optional(),
  // Cook's approximate arrival time when marking a delivery order ready. Must
  // fall inside the order's snapshotted delivery window (validated below).
  arrivalAt: z.string().datetime().optional(),
});

// Allowed forward/backward moves a cook can make. Note `confirmed` can only go
// to `ready` or `cancelled` — never back to `pending`. Once a cook accepts an
// order they cannot "unaccept" it; this is enforced both here and by the body
// schema, which doesn't accept `pending` as a target at all.
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["ready", "cancelled"],
  ready: ["confirmed", "cancelled"],
};

export async function PATCH(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { orderId } = await params;
  if (!orderIdSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { status: newStatus, reason, arrivalAt } = parsed.data;

  try {
    const [order] = await db
      .select({
        id: orders.id,
        cookId: orders.cookId,
        status: orders.status,
        quantity: orders.quantity,
        totalPrice: orders.totalPrice,
        currency: orders.currency,
        pickupAt: orders.pickupAt,
        fulfillmentMode: orders.fulfillmentMode,
        fulfillmentWindowStart: orders.fulfillmentWindowStart,
        fulfillmentWindowEnd: orders.fulfillmentWindowEnd,
        lateCancelFeeEnabled: orders.lateCancelFeeEnabled,
        lateCancelFeeType: orders.lateCancelFeeType,
        lateCancelFeeValue: orders.lateCancelFeeValue,
        lateCancelWindowHours: orders.lateCancelWindowHours,
        depositAmount: orders.depositAmount,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const previousStatus = order.status;
    const allowedTransitions = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        { error: "Invalid status transition." },
        { status: 400 },
      );
    }

    // On confirmation: release the deposit PI to the cook
    if (newStatus === "confirmed") {
      const [depositPayment] = await db
        .select({
          id: orderPayments.id,
          stripePaymentIntentId: orderPayments.stripePaymentIntentId,
        })
        .from(orderPayments)
        .where(
          and(
            eq(orderPayments.orderId, orderId),
            eq(orderPayments.type, "deposit"),
            eq(orderPayments.status, "authorized"),
          ),
        )
        .limit(1);

      if (depositPayment?.stripePaymentIntentId) {
        await capturePaymentIntent(
          depositPayment.stripePaymentIntentId,
          `deposit-release-${orderId}`,
        );
        await db
          .update(orderPayments)
          .set({ status: "released", releasedAt: new Date() })
          .where(eq(orderPayments.id, depositPayment.id));
      }
    }

    // On cancellation: handle payment based on who cancels and why
    if (newStatus === "cancelled") {
      const allPayments = await db
        .select({
          id: orderPayments.id,
          type: orderPayments.type,
          status: orderPayments.status,
          totalAmount: orderPayments.totalAmount,
          stripePaymentIntentId: orderPayments.stripePaymentIntentId,
          cookPayoutAmount: orderPayments.cookPayoutAmount,
          platformFeePct: orderPayments.platformFeePct,
        })
        .from(orderPayments)
        .where(eq(orderPayments.orderId, orderId));

      const isClientNoShow = reason === "client_no_show";
      let fullPaymentReleased = false;

      for (const payment of allPayments) {
        if (!payment.stripePaymentIntentId) continue;

        if (isClientNoShow) {
          // Client no-show: cook gets everything
          if (payment.status === "authorized") {
            await capturePaymentIntent(
              payment.stripePaymentIntentId,
              `noshow-capture-${orderId}-${payment.type}`,
            );
            await db
              .update(orderPayments)
              .set({ status: "released", releasedAt: new Date() })
              .where(eq(orderPayments.id, payment.id));
            if (payment.type === "full") fullPaymentReleased = true;
          }
          // deposit row is already released at confirmation — skip
          continue;
        }

        // Cook cancels voluntarily
        if (payment.status === "authorized") {
          // deposit row before confirmation: cancel PI (full refund to client)
          await cancelPaymentIntent(
            payment.stripePaymentIntentId,
            `cook-cancel-${orderId}-${payment.type}`,
          );
          await db
            .update(orderPayments)
            .set({ status: "refunded", refundedAt: new Date() })
            .where(eq(orderPayments.id, payment.id));
        } else if (
          payment.status === "released" &&
          payment.type === "deposit"
        ) {
          // Deposit was already captured+transferred to cook; reverse it
          const refundId = await refundPaymentIntent({
            paymentIntentId: payment.stripePaymentIntentId,
            reverseTransfer: true,
            idempotencyKey: `cook-cancel-deposit-refund-${orderId}`,
          });
          await db
            .update(orderPayments)
            .set({
              status: "refunded",
              stripeRefundId: refundId,
              refundedAt: new Date(),
            })
            .where(eq(orderPayments.id, payment.id));
        } else if (payment.status === "held") {
          const refundId = await refundPaymentIntent({
            paymentIntentId: payment.stripePaymentIntentId,
            idempotencyKey: `cook-cancel-held-refund-${orderId}-${payment.id}`,
          });
          await db
            .update(orderPayments)
            .set({
              status: "refunded",
              stripeRefundId: refundId,
              refundedAt: new Date(),
            })
            .where(eq(orderPayments.id, payment.id));
        }
      }

      // On a client no-show the full payment is captured+released to the cook,
      // so pay any platform-funded discount top-up too (best-effort, idempotent).
      if (fullPaymentReleased) {
        await settleCookSubsidy(orderId);
      }
    }

    // Guard against marking ready too far ahead. A cook may only mark an order
    // ready from the calendar day before the scheduled fulfillment onward — the
    // pickup code has a finite life, so releasing it days early risks it
    // expiring before the customer arrives.
    if (newStatus === "ready" && !canMarkReady(order)) {
      return NextResponse.json(
        {
          error:
            "This order is scheduled further out. You can mark it ready " +
            "starting the day before the scheduled pickup or delivery.",
        },
        { status: 400 },
      );
    }

    // Delivery orders capture the cook's approximate arrival time as a required
    // step of going ready. It must fall inside the snapshotted delivery window,
    // and becomes the order's exact `pickupAt` minute (which also anchors the
    // pickup-code expiry and the customer's "order ready" notification).
    let deliveryArrivalAt: Date | null = null;
    if (newStatus === "ready" && order.fulfillmentMode === "delivery") {
      if (!arrivalAt) {
        return NextResponse.json(
          {
            error:
              "Select your approximate arrival time before marking this " +
              "delivery ready.",
          },
          { status: 400 },
        );
      }
      const arrival = new Date(arrivalAt);
      const hasWindow =
        order.fulfillmentWindowStart != null &&
        order.fulfillmentWindowEnd != null;
      if (
        hasWindow &&
        !isArrivalWithinWindow(
          arrival,
          order.fulfillmentWindowStart,
          order.fulfillmentWindowEnd,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Your arrival time must be within the customer's delivery window.",
          },
          { status: 400 },
        );
      }
      deliveryArrivalAt = arrival;
    }

    // Guard before issuing a pickup/delivery code so cooks never release food
    // for an order whose remaining payment cannot be collected.
    if (newStatus === "ready") {
      const paymentRows = await db
        .select({
          type: orderPayments.type,
          status: orderPayments.status,
        })
        .from(orderPayments)
        .where(eq(orderPayments.orderId, orderId));
      if (findUncollectiblePayment(paymentRows)) {
        return NextResponse.json(
          {
            error:
              "Payment hasn't been authorized yet. The customer must complete payment before this order can be marked ready.",
          },
          { status: 402 },
        );
      }
    }

    const updateFields: Partial<typeof orders.$inferInsert> = {
      status: newStatus,
    };
    let pickupCodeForEmail: string | null = null;
    if (newStatus === "ready") {
      const rawCode = randomInt(100000, 1000000).toString().padStart(6, "0");
      pickupCodeForEmail = rawCode;
      const hash = createHash("sha256").update(rawCode).digest("hex");
      // Anchor expiry to the latest moment in the order's fulfillment range
      // (window end, or the exact pickup minute) + 6h, with a 24h-from-now
      // floor so a stale/past schedule still yields a usable code.
      const minExpiry = new Date(Date.now() + 24 * 3600_000);
      const scheduleTimes = [
        deliveryArrivalAt ?? order.pickupAt,
        order.fulfillmentWindowEnd,
        order.fulfillmentWindowStart,
      ]
        .filter((d): d is Date => d != null)
        .map((d) => d.getTime());
      const latestSchedule = scheduleTimes.length
        ? Math.max(...scheduleTimes)
        : null;
      const scheduleBasedExpiry =
        latestSchedule != null
          ? new Date(latestSchedule + 6 * 3600_000)
          : minExpiry;
      const expiry =
        scheduleBasedExpiry > minExpiry ? scheduleBasedExpiry : minExpiry;
      updateFields.pickupCode = rawCode;
      updateFields.pickupCodeHash = hash;
      updateFields.pickupCodeExpiresAt = expiry;
      updateFields.pickupCodeAttempts = 0;
      // Pin the cook's chosen delivery minute so the customer's notification
      // and order detail show a concrete arrival time.
      if (deliveryArrivalAt) updateFields.pickupAt = deliveryArrivalAt;
    }
    if (newStatus === "cancelled") {
      updateFields.cancelledAt = new Date();
      updateFields.cancelledBy = (
        await db
          .select({ userId: cookProfiles.userId })
          .from(cookProfiles)
          .where(eq(cookProfiles.id, cookId))
          .limit(1)
      )[0]?.userId;
    }

    const [updated] = await db
      .update(orders)
      .set(updateFields)
      .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
      .returning({
        id: orders.id,
        status: orders.status,
        updatedAt: orders.updatedAt,
      });

    if (
      newStatus === "confirmed" ||
      newStatus === "ready" ||
      newStatus === "cancelled"
    ) {
      // Fire and forget — non-blocking
      db.select({
        clientEmail: authUser.email,
        clientFirstName: authUser.firstName,
        clientPhone: authUser.phone,
        clientPhoneVerified: authUser.phoneVerified,
        clientNotificationPreferences: authUser.notificationPreferences,
        totalPrice: orders.totalPrice,
        currency: orders.currency,
        deliveryFeeSnapshot: orders.deliveryFeeSnapshot,
        taxAmount: orders.taxAmount,
        pickupAt: orders.pickupAt,
        fulfillmentMode: orders.fulfillmentMode,
        fulfillmentWindowStart: orders.fulfillmentWindowStart,
        fulfillmentWindowEnd: orders.fulfillmentWindowEnd,
        cookName: cookProfiles.displayName,
        cookPickupStreet: cookProfiles.pickupStreet,
        cookPickupUnit: cookProfiles.pickupUnit,
        cookPickupCity: cookProfiles.pickupCity,
        cookPickupProvince: cookProfiles.pickupProvince,
        cookPickupPostal: cookProfiles.pickupPostal,
      })
        .from(orders)
        .innerJoin(authUser, eq(orders.clientId, authUser.id))
        .innerJoin(cookProfiles, eq(orders.cookId, cookProfiles.id))
        .where(eq(orders.id, orderId))
        .limit(1)
        .then(async ([row]) => {
          if (!row) return;
          const dishRows = await db
            .select({
              name: orderDishes.dishName,
              quantity: orderDishes.quantity,
              lineTotal: orderDishes.lineTotal,
              discountAmount: orderDishes.discountAmount,
              sortOrder: orderDishes.sortOrder,
            })
            .from(orderDishes)
            .where(eq(orderDishes.orderId, orderId));
          const orderedDishes = [...dishRows].sort(
            (a, b) => a.sortOrder - b.sortOrder,
          );
          const client = {
            email: row.clientEmail as string,
            firstName: row.clientFirstName as string | null,
            phone: row.clientPhone as string | null,
            phoneVerified: row.clientPhoneVerified as boolean,
            notificationPreferences: row.clientNotificationPreferences,
          };
          const fulfillmentMode: "pickup" | "delivery" | null =
            row.fulfillmentMode === "pickup" ||
            row.fulfillmentMode === "delivery"
              ? row.fulfillmentMode
              : null;
          const pickupLocation =
            fulfillmentMode === "pickup"
              ? formatPickupLocation({
                  street: row.cookPickupStreet,
                  unit: row.cookPickupUnit,
                  city: row.cookPickupCity,
                  province: row.cookPickupProvince,
                  postal: row.cookPickupPostal,
                })
              : null;
          const orderData = {
            id: orderId,
            listingTitle: orderedDishes.map((d) => d.name).join(", "),
            quantity: orderedDishes.reduce((s, d) => s + d.quantity, 0),
            totalPrice: row.totalPrice,
            currency: row.currency,
            pickupAt: row.pickupAt,
            fulfillmentMode,
            pickupLocation,
            fulfillmentWindowStart: row.fulfillmentWindowStart,
            fulfillmentWindowEnd: row.fulfillmentWindowEnd,
            items: orderedDishes.map((d) => ({
              name: d.name,
              quantity: d.quantity,
              lineTotal: d.lineTotal,
              discountAmount: d.discountAmount,
            })),
            deliveryFee: row.deliveryFeeSnapshot,
            taxAmount: row.taxAmount,
          };
          if (newStatus === "confirmed") {
            if (previousStatus === "ready") {
              return sendOrderNotReadyEmailToClient(
                client,
                { name: row.cookName },
                orderData,
              );
            }
            return sendOrderConfirmedEmailToClient(
              client,
              { name: row.cookName },
              orderData,
            );
          }
          if (newStatus === "ready" && pickupCodeForEmail) {
            return sendOrderReadyEmailToClient(
              client,
              { name: row.cookName },
              orderData,
              pickupCodeForEmail,
            );
          }
          if (newStatus === "cancelled") {
            return sendOrderCancelledByCookEmailToClient(
              client,
              { name: row.cookName },
              orderData,
            );
          }
        })
        .catch((err) => console.error("[status/email]", err));
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[dashboard/orders/status]", err);
    return NextResponse.json(
      { error: "Failed to update order status." },
      { status: 500 },
    );
  }
}
