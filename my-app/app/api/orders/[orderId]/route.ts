import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  authUser,
  cookProfiles,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { sendOrderCancelledByClientEmailToCook } from "@/lib/emails/order-events";
import { isRefundEligible } from "@/lib/order-pricing";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
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
    .toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
    .toLowerCase()
    .replace(":00", "");
  const end = new Date(d.getTime() + windowHours * 3600000)
    .toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
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
        totalPrice: orders.totalPrice,
        currency: orders.currency,
        pickupAt: orders.pickupAt,
        notes: orders.notes,
        createdAt: orders.createdAt,
        pickupCode: orders.pickupCode,
        fulfillmentMode: orders.fulfillmentMode,
        deliveryAddress: orders.deliveryAddress,
        deliveryFeeSnapshot: orders.deliveryFeeSnapshot,
        cancellationAllowed: orders.cancellationAllowed,
        cancelledAt: orders.cancelledAt,
        cookFirstName: authUser.firstName,
        cookLastName: authUser.lastName,
        cookNeighborhood: authUser.neighborhood,
        cookPickupAddress: cookProfiles.pickupAddress,
        cookLeadTime: cookProfiles.leadTime,
      })
      .from(orders)
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
        priceSnapshot: orderDishes.priceSnapshot,
        discountAmount: orderDishes.discountAmount,
        lineTotal: orderDishes.lineTotal,
        sortOrder: orderDishes.sortOrder,
      })
      .from(orderDishes)
      .where(eq(orderDishes.orderId, orderId));

    const pickupAtIso =
      row.pickupAt instanceof Date ? row.pickupAt.toISOString() : row.pickupAt;

    const cookName =
      [row.cookFirstName, row.cookLastName].filter(Boolean).join(" ") || null;
    const cookInitials =
      [row.cookFirstName?.[0], row.cookLastName?.[0]]
        .filter(Boolean)
        .join("") || null;

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
      pickupAddress = row.cookPickupAddress ?? row.cookNeighborhood ?? null;
    }

    const refundEligible = isRefundEligible(
      row.pickupAt instanceof Date ? row.pickupAt : null,
      row.cookLeadTime,
      row.cancellationAllowed,
    );
    const cancellable =
      ["pending", "confirmed"].includes(row.status) && row.pickupAt != null;

    const data = {
      id: row.id,
      status: row.status,
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
      deliveryFeeSnapshot: row.deliveryFeeSnapshot,
      cancellationAllowed: row.cancellationAllowed,
      cancellable,
      refundEligible,
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

// Client cancellation. Full refund only when the cook allows cancellation AND
// the order has a pickup time AND we are still before (pickupAt - leadTime).
// Otherwise the order is cancelled with no refund (payment captured to the cook).
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
        status: orders.status,
        totalPrice: orders.totalPrice,
        currency: orders.currency,
        pickupAt: orders.pickupAt,
        cancellationAllowed: orders.cancellationAllowed,
        cookLeadTime: cookProfiles.leadTime,
      })
      .from(orders)
      .leftJoin(cookProfiles, eq(orders.cookId, cookProfiles.id))
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

    const refundEligible = isRefundEligible(
      order.pickupAt instanceof Date ? order.pickupAt : null,
      order.cookLeadTime,
      order.cancellationAllowed,
    );

    const payments = await db
      .select({
        id: orderPayments.id,
        status: orderPayments.status,
        stripePaymentIntentId: orderPayments.stripePaymentIntentId,
      })
      .from(orderPayments)
      .where(eq(orderPayments.orderId, orderId));

    for (const payment of payments) {
      if (!payment.stripePaymentIntentId) continue;

      if (refundEligible) {
        // Authorized holds are cancelled; captured funds are refunded.
        if (payment.status === "authorized") {
          await cancelPaymentIntent(
            payment.stripePaymentIntentId,
            `client-cancel-${orderId}`,
          );
          await db
            .update(orderPayments)
            .set({ status: "refunded", refundedAt: new Date() })
            .where(eq(orderPayments.id, payment.id));
        } else if (payment.status === "held" || payment.status === "released") {
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
      } else if (payment.status === "authorized") {
        // No refund — capture the authorized payment to the cook.
        await capturePaymentIntent(
          payment.stripePaymentIntentId,
          `client-cancel-capture-${orderId}`,
        );
        await db
          .update(orderPayments)
          .set({ status: "released", releasedAt: new Date() })
          .where(eq(orderPayments.id, payment.id));
      }
    }

    await db
      .update(orders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: session.user.id,
      })
      .where(and(eq(orders.id, orderId), eq(orders.clientId, session.user.id)));

    // Notify the cook (fire-and-forget) with the dish names.
    db.select({
      cookEmail: authUser.email,
      cookFirstName: authUser.firstName,
    })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(eq(cookProfiles.id, order.cookId))
      .limit(1)
      .then(async ([row]) => {
        if (!row) return;
        const dishRows = await db
          .select({
            name: orderDishes.dishName,
            quantity: orderDishes.quantity,
          })
          .from(orderDishes)
          .where(eq(orderDishes.orderId, orderId));
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
            listingTitle: dishRows.map((d) => d.name).join(", "),
            quantity: dishRows.reduce((s, d) => s + d.quantity, 0),
            totalPrice: order.totalPrice,
            currency: order.currency,
            pickupAt: order.pickupAt,
          },
        );
      })
      .catch((err) => console.error("[orders/DELETE] email", err));

    return NextResponse.json({ success: true, refunded: refundEligible });
  } catch (err) {
    console.error("[orders/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to cancel order." },
      { status: 500 },
    );
  }
}
