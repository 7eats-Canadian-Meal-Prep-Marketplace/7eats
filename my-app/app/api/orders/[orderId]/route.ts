import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  authUser,
  cookProfiles,
  listings,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { sendOrderCancelledByClientEmailToCook } from "@/lib/emails/order-events";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  partialCapturePaymentIntent,
  refundPaymentIntent,
} from "@/lib/stripe-payments";

function formatPickupDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatPickupWindow(isoString: string, windowHours = 2): string {
  const d = new Date(isoString);
  const start = d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: undefined,
      hour12: true,
    })
    .toLowerCase()
    .replace(":00", "");
  const end = new Date(d.getTime() + windowHours * 3600000)
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: undefined,
      hour12: true,
    })
    .toLowerCase()
    .replace(":00", "");
  return `${start} – ${end}`;
}

export type Params = { params: Promise<{ orderId: string }> };

const orderIdSchema = z.string().uuid();

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "client") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { orderId } = await params;
  if (!orderIdSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  try {
    const [row] = await db
      .select({
        id: orders.id,
        status: orders.status,
        listingId: orders.listingId,
        listingTitle: listings.title,
        quantity: orders.quantity,
        unitPrice: orders.unitPrice,
        totalPrice: orders.totalPrice,
        currency: orders.currency,
        pickupAt: orders.pickupAt,
        notes: orders.notes,
        createdAt: orders.createdAt,
        pickupCode: orders.pickupCode,
        fulfillmentMode: orders.fulfillmentMode,
        deliveryAddress: orders.deliveryAddress,
        subscriptionId: orders.subscriptionId,
        cancelledAt: orders.cancelledAt,
        cancelledBy: orders.cancelledBy,
        cookFirstName: authUser.firstName,
        cookLastName: authUser.lastName,
        cookNeighborhood: authUser.neighborhood,
        cookPickupAddress: cookProfiles.pickupAddress,
      })
      .from(orders)
      .leftJoin(listings, eq(orders.listingId, listings.id))
      .leftJoin(cookProfiles, eq(orders.cookId, cookProfiles.id))
      .leftJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(and(eq(orders.id, orderId), eq(orders.clientId, session.user.id)))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const dishRows = await db
      .select({
        id: orderDishes.id,
        dishName: orderDishes.dishName,
        quantity: orderDishes.quantity,
        sortOrder: orderDishes.sortOrder,
      })
      .from(orderDishes)
      .where(inArray(orderDishes.orderId, [orderId]));

    const pickupAtIso =
      row.pickupAt instanceof Date ? row.pickupAt.toISOString() : row.pickupAt;

    const cookName =
      [row.cookFirstName, row.cookLastName].filter(Boolean).join(" ") || null;
    const cookInitials =
      [row.cookFirstName?.[0], row.cookLastName?.[0]]
        .filter(Boolean)
        .join("") || null;

    // Derive pickup address from fulfillment mode
    let pickupAddress: string | null = null;
    if (row.fulfillmentMode === "delivery") {
      const addr = row.deliveryAddress as Record<string, string> | null;
      if (addr) {
        pickupAddress = [
          addr.street,
          addr.unit,
          addr.city,
          addr.province,
          addr.postal,
        ]
          .filter(Boolean)
          .join(", ");
      }
    } else {
      // pickup or null — use cook's pickup address, fall back to neighborhood
      pickupAddress = row.cookPickupAddress ?? row.cookNeighborhood ?? null;
    }

    const data = {
      id: row.id,
      status: row.status,
      listingId: row.listingId,
      listingTitle: row.listingTitle ?? null,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      totalPrice: row.totalPrice,
      currency: row.currency,
      pickupAt: pickupAtIso,
      notes: row.notes ?? null,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : row.createdAt,
      pickupCode: row.status === "ready" ? (row.pickupCode ?? null) : null,
      cookName,
      cookInitials,
      fulfillmentMode: row.fulfillmentMode,
      isSubscription: row.subscriptionId !== null,
      pickupDate: pickupAtIso ? formatPickupDate(pickupAtIso) : null,
      pickupWindow: pickupAtIso ? formatPickupWindow(pickupAtIso) : null,
      pickupAddress,
      cancelledAt:
        row.cancelledAt instanceof Date
          ? row.cancelledAt.toISOString()
          : (row.cancelledAt ?? null),
      deliveryAddress:
        row.fulfillmentMode === "delivery"
          ? (row.deliveryAddress as object | null)
          : null,
      dishes: dishRows.sort((a, b) => a.sortOrder - b.sortOrder),
    };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[orders/orderId/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch order." },
      { status: 500 },
    );
  }
}

const CANCELLABLE_STATUSES = ["pending", "confirmed"];

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderIdSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  try {
    const [order] = await db
      .select({
        id: orders.id,
        clientId: orders.clientId,
        cookId: orders.cookId,
        listingId: orders.listingId,
        status: orders.status,
        quantity: orders.quantity,
        totalPrice: orders.totalPrice,
        currency: orders.currency,
        pickupAt: orders.pickupAt,
        lateCancelFeeEnabled: orders.lateCancelFeeEnabled,
        lateCancelFeeType: orders.lateCancelFeeType,
        lateCancelFeeValue: orders.lateCancelFeeValue,
        lateCancelWindowHours: orders.lateCancelWindowHours,
        depositAmount: orders.depositAmount,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.clientId, session.user.id)))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json(
        { error: "Order cannot be cancelled at this stage." },
        { status: 400 },
      );
    }

    const allPayments = await db
      .select({
        id: orderPayments.id,
        type: orderPayments.type,
        status: orderPayments.status,
        totalAmount: orderPayments.totalAmount,
        stripePaymentIntentId: orderPayments.stripePaymentIntentId,
        platformFeePct: orderPayments.platformFeePct,
      })
      .from(orderPayments)
      .where(eq(orderPayments.orderId, orderId));

    // Compute capture floor
    const now = new Date();
    const pickupAt = order.pickupAt;
    const windowMs = (order.lateCancelWindowHours ?? 24) * 60 * 60 * 1000;
    const withinWindow =
      pickupAt !== null && now > new Date(pickupAt.getTime() - windowMs);

    const totalPrice = parseFloat(order.totalPrice);
    const depositAmount = order.depositAmount
      ? parseFloat(order.depositAmount)
      : 0;

    let lateCancelFee = 0;
    if (
      order.lateCancelFeeEnabled &&
      withinWindow &&
      order.lateCancelFeeValue
    ) {
      const feeVal = parseFloat(order.lateCancelFeeValue);
      lateCancelFee =
        order.lateCancelFeeType === "flat"
          ? Math.min(feeVal, totalPrice)
          : Math.min((totalPrice * feeVal) / 100, totalPrice);
    }

    // If deposit already covers protection, no additional capture on balance
    const totalCaptureFloor = Math.max(depositAmount, lateCancelFee);
    // For the active (non-deposit) PI: capture max(0, totalCaptureFloor - depositAmount)
    const additionalCapture = Math.max(0, totalCaptureFloor - depositAmount);
    const additionalCaptureCents = Math.round(additionalCapture * 100);

    for (const payment of allPayments) {
      if (!payment.stripePaymentIntentId) continue;

      if (payment.type === "deposit" && payment.status === "released") {
        // Deposit already with cook — stays there regardless (non-refundable after confirmation)
        continue;
      }

      if (payment.type === "deposit" && payment.status === "authorized") {
        // Deposit not yet captured (order still pending) — cancel/refund to client
        await cancelPaymentIntent(
          payment.stripePaymentIntentId,
          `client-cancel-deposit-${orderId}`,
        );
        await db
          .update(orderPayments)
          .set({ status: "refunded", refundedAt: new Date() })
          .where(eq(orderPayments.id, payment.id));
        continue;
      }

      // full or balance PI
      if (payment.status === "authorized") {
        const paymentTotalCents = Math.round(
          parseFloat(payment.totalAmount) * 100,
        );

        if (
          additionalCaptureCents > 0 &&
          additionalCaptureCents < paymentTotalCents
        ) {
          // Partial capture for late cancel fee
          const platformFeePct = parseFloat(payment.platformFeePct ?? "0");
          const newFeeCents = Math.round(
            (additionalCaptureCents * platformFeePct) / 100,
          );
          await partialCapturePaymentIntent({
            piId: payment.stripePaymentIntentId,
            captureAmountCents: additionalCaptureCents,
            newPlatformFeeCents: newFeeCents,
            idempotencyKey: `client-cancel-partial-${orderId}`,
          });
          await db
            .update(orderPayments)
            .set({
              status: "released",
              releasedAt: new Date(),
            })
            .where(eq(orderPayments.id, payment.id));
        } else if (additionalCaptureCents >= paymentTotalCents) {
          // Cook keeps full balance payment
          await capturePaymentIntent(
            payment.stripePaymentIntentId,
            `client-cancel-full-capture-${orderId}`,
          );
          await db
            .update(orderPayments)
            .set({ status: "released", releasedAt: new Date() })
            .where(eq(orderPayments.id, payment.id));
        } else {
          // Full refund to client
          await cancelPaymentIntent(
            payment.stripePaymentIntentId,
            `client-cancel-${orderId}-${payment.type}`,
          );
          await db
            .update(orderPayments)
            .set({ status: "refunded", refundedAt: new Date() })
            .where(eq(orderPayments.id, payment.id));
        }
      } else if (payment.status === "held") {
        // Subscription payment — refund
        const refundId = await refundPaymentIntent({
          paymentIntentId: payment.stripePaymentIntentId,
          idempotencyKey: `client-cancel-refund-${orderId}`,
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

    await db
      .update(orders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: session.user.id,
        ...(lateCancelFee > 0
          ? { lateCancelFeeApplied: String(lateCancelFee.toFixed(2)) }
          : {}),
      })
      .where(and(eq(orders.id, orderId), eq(orders.clientId, session.user.id)));

    // Fire and forget — non-blocking
    db.select({
      cookEmail: authUser.email,
      cookFirstName: authUser.firstName,
      listingTitle: listings.title,
    })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .innerJoin(listings, eq(listings.id, order.listingId ?? ""))
      .where(eq(cookProfiles.id, order.cookId))
      .limit(1)
      .then(([row]) => {
        if (!row) return;
        const customerName =
          session.user.name ||
          [session.user.firstName, session.user.lastName]
            .filter(Boolean)
            .join(" ") ||
          "A customer";
        return sendOrderCancelledByClientEmailToCook(
          { email: row.cookEmail, firstName: row.cookFirstName },
          { name: customerName },
          {
            id: order.id,
            listingTitle: row.listingTitle,
            quantity: order.quantity ?? 1,
            totalPrice: order.totalPrice,
            currency: order.currency,
            pickupAt: order.pickupAt,
          },
        );
      })
      .catch((err) => console.error("[orders/DELETE] email", err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[orders/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to cancel order." },
      { status: 500 },
    );
  }
}
