import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import {
  authUser,
  listings,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import { orderHasPlacedPaymentFilter } from "@/lib/orders/abandoned-checkout";

const querySchema = z.object({
  status: z
    .enum(["pending", "confirmed", "ready", "fulfilled", "cancelled"])
    .optional(),
  listingId: z.uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query parameters." },
      { status: 400 },
    );
  }

  const { status, listingId, dateFrom, dateTo, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(orders.cookId, cookId), orderHasPlacedPaymentFilter()];
  if (status) conditions.push(eq(orders.status, status));
  if (listingId) conditions.push(eq(orders.listingId, listingId));
  // Date range filters the *scheduled* day. `pickupAt` is only ever set for
  // delivery once a cook pins an exact minute and is always null for pickup
  // orders, so filtering on it alone hides every pickup order (and confirmed
  // orders that lack a pinned time) from the calendar. Fall back to the
  // fulfillment window, which is captured for both modes at placement.
  const scheduledAt = sql`COALESCE(${orders.fulfillmentWindowStart}, ${orders.pickupAt})`;
  if (dateFrom) conditions.push(gte(scheduledAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(scheduledAt, new Date(dateTo)));

  const where = and(...conditions);

  try {
    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: orders.id,
          cookId: orders.cookId,
          clientId: orders.clientId,
          listingId: orders.listingId,
          status: orders.status,
          quantity: orders.quantity,
          unitPrice: orders.unitPrice,
          // Total items across the (multi-dish) order. The deprecated
          // order-level `quantity` is null for current orders, so derive the
          // count from order_dishes for an accurate list summary.
          itemCount: sql<number>`(
            SELECT COALESCE(SUM(${orderDishes.quantity}), 0)::int
            FROM ${orderDishes}
            WHERE ${orderDishes.orderId} = ${orders.id}
          )`,
          totalPrice: orders.totalPrice,
          taxAmount: orders.taxAmount,
          deliveryFeeSnapshot: orders.deliveryFeeSnapshot,
          pickupAt: orders.pickupAt,
          fulfillmentWindowStart: orders.fulfillmentWindowStart,
          fulfillmentWindowEnd: orders.fulfillmentWindowEnd,
          fulfillmentMode: orders.fulfillmentMode,
          fulfilledAt: orders.fulfilledAt,
          cancelledAt: orders.cancelledAt,
          notes: orders.notes,
          deliveryDetails: orders.deliveryDetails,
          createdAt: orders.createdAt,
          pickupCodeExpiresAt: orders.pickupCodeExpiresAt,
          pickupCodeVerifiedAt: orders.pickupCodeVerifiedAt,
          pickupCodeAttempts: orders.pickupCodeAttempts,
          lateCancelFeeEnabled: orders.lateCancelFeeEnabled,
          lateCancelFeeType: orders.lateCancelFeeType,
          lateCancelFeeValue: orders.lateCancelFeeValue,
          lateCancelWindowHours: orders.lateCancelWindowHours,
          lateCancelFeeApplied: orders.lateCancelFeeApplied,
          listingTitle: listings.title,
          customerName: authUser.name,
          customerFirstName: authUser.firstName,
          customerLastName: authUser.lastName,
          clientAccountStatus: authUser.status,
          isGuestCheckout: orders.isGuestCheckout,
          clientIsGuestAccount: authUser.isGuestAccount,
          platformFeePct: orderPayments.platformFeePct,
          platformFeeAmount: orderPayments.platformFeeAmount,
          cookPayoutAmount: orderPayments.cookPayoutAmount,
        })
        .from(orders)
        .leftJoin(listings, eq(orders.listingId, listings.id))
        .leftJoin(authUser, eq(orders.clientId, authUser.id))
        .leftJoin(
          orderPayments,
          and(
            eq(orderPayments.orderId, orders.id),
            eq(orderPayments.type, "full"),
          ),
        )
        .where(where)
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset),

      db.select({ total: count() }).from(orders).where(where),
    ]);

    const total = Number(totalResult[0]?.total ?? 0);

    return NextResponse.json({
      success: true,
      data: rows,
      meta: { total, page, limit },
    });
  } catch (err) {
    console.error("[dashboard/orders]", err);
    return NextResponse.json(
      { error: "Failed to fetch orders." },
      { status: 500 },
    );
  }
}
