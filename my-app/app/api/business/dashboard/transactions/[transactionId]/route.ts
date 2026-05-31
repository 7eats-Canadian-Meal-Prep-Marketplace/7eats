import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { listings, orderPayments, orders } from "@/db/schema";

export type Params = { params: Promise<{ transactionId: string }> };

const transactionIdSchema = z.string().uuid();

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { transactionId } = await params;

  const parsed = transactionIdSchema.safeParse(transactionId);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid transaction ID." },
      { status: 400 },
    );
  }

  try {
    const [transaction] = await db
      .select({
        id: orderPayments.id,
        orderId: orderPayments.orderId,
        status: orderPayments.status,
        totalAmount: orderPayments.totalAmount,
        platformFeePct: orderPayments.platformFeePct,
        platformFeeAmount: orderPayments.platformFeeAmount,
        cookPayoutAmount: orderPayments.cookPayoutAmount,
        currency: orderPayments.currency,
        stripePaymentIntentId: orderPayments.stripePaymentIntentId,
        stripeChargeId: orderPayments.stripeChargeId,
        stripeTransferId: orderPayments.stripeTransferId,
        stripeRefundId: orderPayments.stripeRefundId,
        authorizedAt: orderPayments.authorizedAt,
        heldAt: orderPayments.heldAt,
        releasedAt: orderPayments.releasedAt,
        refundedAt: orderPayments.refundedAt,
        createdAt: orderPayments.createdAt,
        listingTitle: listings.title,
        pickupAt: orders.pickupAt,
        orderStatus: orders.status,
      })
      .from(orderPayments)
      .leftJoin(orders, eq(orderPayments.orderId, orders.id))
      .leftJoin(listings, eq(orders.listingId, listings.id))
      .where(
        and(
          eq(orderPayments.id, transactionId),
          eq(orderPayments.cookId, cookId),
        ),
      )
      .limit(1);

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: transaction });
  } catch (err) {
    console.error("[dashboard/transactions/[transactionId]]", err);
    return NextResponse.json(
      { error: "Failed to fetch transaction." },
      { status: 500 },
    );
  }
}
