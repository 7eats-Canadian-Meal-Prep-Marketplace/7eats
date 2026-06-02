import { createHash, randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles, orderPayments, orders } from "@/db/schema";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  partialCapturePaymentIntent,
  refundPaymentIntent,
} from "@/lib/stripe-payments";

export type Params = { params: Promise<{ orderId: string }> };

const orderIdSchema = z.uuid();

const bodySchema = z.object({
  status: z.enum(["confirmed", "ready", "cancelled"]),
  reason: z.enum(["client_no_show"]).optional(),
});

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

  const { status: newStatus, reason } = parsed.data;

  try {
    const [order] = await db
      .select({
        id: orders.id,
        cookId: orders.cookId,
        status: orders.status,
        totalPrice: orders.totalPrice,
        pickupAt: orders.pickupAt,
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
        }
      }
    }

    const updateFields: Partial<typeof orders.$inferInsert> = {
      status: newStatus,
    };
    if (newStatus === "ready") {
      const rawCode = randomInt(100000, 1000000).toString().padStart(6, "0");
      const hash = createHash("sha256").update(rawCode).digest("hex");
      const minExpiry = new Date(Date.now() + 24 * 3600_000);
      const pickupBasedExpiry = new Date(
        order.pickupAt.getTime() + 6 * 3600_000,
      );
      const expiry =
        pickupBasedExpiry > minExpiry ? pickupBasedExpiry : minExpiry;
      updateFields.pickupCode = rawCode;
      updateFields.pickupCodeHash = hash;
      updateFields.pickupCodeExpiresAt = expiry;
      updateFields.pickupCodeAttempts = 0;
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

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[dashboard/orders/status]", err);
    return NextResponse.json(
      { error: "Failed to update order status." },
      { status: 500 },
    );
  }
}
