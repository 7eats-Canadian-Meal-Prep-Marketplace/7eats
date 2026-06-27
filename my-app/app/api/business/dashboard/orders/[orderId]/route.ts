import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import {
  authUser,
  listings,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";

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
          taxAmount: orders.taxAmount,
          deliveryFeeSnapshot: orders.deliveryFeeSnapshot,
          currency: orders.currency,
          fulfillmentMode: orders.fulfillmentMode,
          deliveryAddress: orders.deliveryAddress,
          pickupAt: orders.pickupAt,
          fulfillmentWindowStart: orders.fulfillmentWindowStart,
          fulfillmentWindowEnd: orders.fulfillmentWindowEnd,
          fulfilledAt: orders.fulfilledAt,
          cancelledAt: orders.cancelledAt,
          notes: orders.notes,
          deliveryDetails: orders.deliveryDetails,
          listingId: orders.listingId,
          listingTitle: listings.title,
          clientId: orders.clientId,
          customerName: authUser.name,
          customerFirstName: authUser.firstName,
          customerLastName: authUser.lastName,
          pickupCodeExpiresAt: orders.pickupCodeExpiresAt,
          pickupCodeVerifiedAt: orders.pickupCodeVerifiedAt,
          pickupCodeAttempts: orders.pickupCodeAttempts,
          lateCancelFeeEnabled: orders.lateCancelFeeEnabled,
          lateCancelFeeApplied: orders.lateCancelFeeApplied,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
          // Cook-facing money breakdown snapshotted at order time so the
          // dashboard can show the platform cut and the net payout.
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
        .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
        .limit(1),

      db
        .select({
          id: orderDishes.id,
          dishId: orderDishes.dishId,
          dishName: orderDishes.dishName,
          quantity: orderDishes.quantity,
          priceSnapshot: orderDishes.priceSnapshot,
          discountAmount: orderDishes.discountAmount,
          lineTotal: orderDishes.lineTotal,
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
