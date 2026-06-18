import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { listings, orderDishes, orders } from "@/db/schema";

export type Params = { params: Promise<{ orderId: string }> };

const orderIdSchema = z.string().uuid();

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { orderId } = await params;

  const parsed = orderIdSchema.safeParse(orderId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  try {
    const [[order], dishes] = await Promise.all([
      db
        .select({
          id: orders.id,
          status: orders.status,
          quantity: orders.quantity,
          unitPrice: orders.unitPrice,
          totalPrice: orders.totalPrice,
          discountAmount: orders.discountAmount,
          currency: orders.currency,
          pickupAt: orders.pickupAt,
          fulfilledAt: orders.fulfilledAt,
          cancelledAt: orders.cancelledAt,
          notes: orders.notes,
          listingId: orders.listingId,
          listingTitle: listings.title,
          clientId: orders.clientId,
          pickupCodeExpiresAt: orders.pickupCodeExpiresAt,
          pickupCodeVerifiedAt: orders.pickupCodeVerifiedAt,
          pickupCodeAttempts: orders.pickupCodeAttempts,
          lateCancelFeeEnabled: orders.lateCancelFeeEnabled,
          lateCancelFeeApplied: orders.lateCancelFeeApplied,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
        })
        .from(orders)
        .leftJoin(listings, eq(orders.listingId, listings.id))
        .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
        .limit(1),

      db
        .select({
          id: orderDishes.id,
          dishId: orderDishes.dishId,
          dishName: orderDishes.dishName,
          quantity: orderDishes.quantity,
          sortOrder: orderDishes.sortOrder,
        })
        .from(orderDishes)
        .where(eq(orderDishes.orderId, orderId))
        .orderBy(asc(orderDishes.sortOrder)),
    ]);

    if (!order) return notFound("Order");

    return NextResponse.json({
      success: true,
      data: { ...order, dishes },
    });
  } catch (err) {
    console.error("[dashboard/orders/[orderId]]", err);
    return NextResponse.json(
      { error: "Failed to fetch order." },
      { status: 500 },
    );
  }
}
