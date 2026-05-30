import { and, count, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { listings, orderPayments, orders } from "@/db/schema";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query params." },
      { status: 400 },
    );
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const [totalResult, data] = await Promise.all([
      db
        .select({ total: count() })
        .from(orderPayments)
        .where(eq(orderPayments.cookId, cookId)),

      db
        .select({
          id: orderPayments.id,
          orderId: orderPayments.orderId,
          cookId: orderPayments.cookId,
          clientId: orderPayments.clientId,
          status: orderPayments.status,
          totalAmount: orderPayments.totalAmount,
          platformFeePct: orderPayments.platformFeePct,
          platformFeeAmount: orderPayments.platformFeeAmount,
          cookPayoutAmount: orderPayments.cookPayoutAmount,
          currency: orderPayments.currency,
          stripePaymentIntentId: orderPayments.stripePaymentIntentId,
          stripeTransferId: orderPayments.stripeTransferId,
          authorizedAt: orderPayments.authorizedAt,
          heldAt: orderPayments.heldAt,
          releasedAt: orderPayments.releasedAt,
          refundedAt: orderPayments.refundedAt,
          createdAt: orderPayments.createdAt,
          listingTitle: listings.title,
          pickupAt: orders.pickupAt,
        })
        .from(orderPayments)
        .leftJoin(orders, eq(orderPayments.orderId, orders.id))
        .leftJoin(listings, eq(orders.listingId, listings.id))
        .where(eq(orderPayments.cookId, cookId))
        .orderBy(desc(orderPayments.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total: Number(totalResult[0]?.total ?? 0),
        page,
        limit,
      },
    });
  } catch (err) {
    console.error("[dashboard/transactions]", err);
    return NextResponse.json(
      { error: "Failed to fetch transactions." },
      { status: 500 },
    );
  }
}
