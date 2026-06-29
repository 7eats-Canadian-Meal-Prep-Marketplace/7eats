import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  dishPromotions,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import { cancelPaymentIntent } from "@/lib/stripe/payments";

/** Unpaid checkout sessions older than this are treated as abandoned. */
export const ABANDONED_CHECKOUT_TTL_MS = 30 * 60 * 1000;

export function isUnpaidCheckoutPayment(status: string): boolean {
  return status === "pending";
}

/** Payment has moved past the checkout card step (authorized, held, released, etc.). */
export function isOrderPaymentPlaced(status: string): boolean {
  return !isUnpaidCheckoutPayment(status);
}

/** SQL EXISTS — only orders whose full payment left the pending checkout state. */
export function orderHasPlacedPaymentFilter() {
  return sql`EXISTS (
    SELECT 1 FROM ${orderPayments}
    WHERE ${orderPayments.orderId} = ${orders.id}
      AND ${orderPayments.type} = 'full'
      AND ${orderPayments.status} <> 'pending'
  )`;
}

type CancelAbandonedResult =
  | { ok: true; cancelled: boolean; orderId: string }
  | { ok: false; orderId: string; reason: string };

/**
 * Cancel a checkout that never completed payment. Idempotent when the order is
 * already cancelled or payment is no longer pending.
 */
export async function cancelAbandonedCheckoutOrder(
  orderId: string,
): Promise<CancelAbandonedResult> {
  const [row] = await db
    .select({
      orderId: orders.id,
      orderStatus: orders.status,
      paymentId: orderPayments.id,
      paymentStatus: orderPayments.status,
      stripePaymentIntentId: orderPayments.stripePaymentIntentId,
    })
    .from(orders)
    .innerJoin(
      orderPayments,
      and(eq(orderPayments.orderId, orders.id), eq(orderPayments.type, "full")),
    )
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) {
    return { ok: false, orderId, reason: "order_not_found" };
  }

  if (row.orderStatus === "cancelled") {
    return { ok: true, cancelled: false, orderId };
  }

  if (!isUnpaidCheckoutPayment(row.paymentStatus)) {
    return { ok: false, orderId, reason: "payment_not_pending" };
  }

  if (row.stripePaymentIntentId) {
    await cancelPaymentIntent(
      row.stripePaymentIntentId,
      `abandon-${orderId}`,
    ).catch((err) => {
      console.error("[cancelAbandonedCheckoutOrder] cancel PI", err);
    });
  }

  const promoRows = await db
    .select({ promotionId: orderDishes.promotionId })
    .from(orderDishes)
    .where(eq(orderDishes.orderId, orderId));

  for (const line of promoRows) {
    if (!line.promotionId) continue;
    await db
      .update(dishPromotions)
      .set({
        usesCount: sql`GREATEST(${dishPromotions.usesCount} - 1, 0)`,
      })
      .where(eq(dishPromotions.id, line.promotionId));
  }

  await db
    .update(orders)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: null,
    })
    .where(eq(orders.id, orderId));

  return { ok: true, cancelled: true, orderId };
}

/** Cancel stale unpaid checkouts (run on a schedule). */
export async function cancelStaleAbandonedCheckouts(
  ttlMs: number = ABANDONED_CHECKOUT_TTL_MS,
): Promise<{ scanned: number; cancelled: string[] }> {
  const cutoff = new Date(Date.now() - ttlMs);

  const stale = await db
    .select({ orderId: orders.id })
    .from(orders)
    .innerJoin(
      orderPayments,
      and(
        eq(orderPayments.orderId, orders.id),
        eq(orderPayments.type, "full"),
        eq(orderPayments.status, "pending"),
      ),
    )
    .where(and(eq(orders.status, "pending"), lt(orders.createdAt, cutoff)));

  const cancelled: string[] = [];
  for (const { orderId } of stale) {
    const result = await cancelAbandonedCheckoutOrder(orderId);
    if (result.ok && result.cancelled) cancelled.push(orderId);
  }

  return { scanned: stale.length, cancelled };
}
