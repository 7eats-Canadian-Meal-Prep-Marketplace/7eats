import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
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
import { sendOrderCompletedEmailToClient } from "@/lib/emails/order-events";
import { findUncollectiblePayment } from "@/lib/orders/fulfillment-readiness";
import { settleCookSubsidy } from "@/lib/orders/settle-subsidy";
import {
  capturePaymentIntent,
  createSubscriptionTransfer,
} from "@/lib/stripe/payments";

export type Params = { params: Promise<{ orderId: string }> };

const orderIdSchema = z.uuid();

const bodySchema = z.object({
  code: z.string().min(1).max(20),
});

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { orderId } = await params;

  const orderIdParsed = orderIdSchema.safeParse(orderId);
  if (!orderIdParsed.success) {
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

  const { code } = parsed.data;

  try {
    const [order] = await db
      .select({
        id: orders.id,
        cookId: orders.cookId,
        status: orders.status,
        pickupCodeHash: orders.pickupCodeHash,
        pickupCodeExpiresAt: orders.pickupCodeExpiresAt,
        pickupCodeAttempts: orders.pickupCodeAttempts,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status !== "ready") {
      return NextResponse.json(
        { error: "Order is not ready for pickup." },
        { status: 400 },
      );
    }

    if (order.pickupCodeAttempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts. Contact support." },
        { status: 429 },
      );
    }

    if (!order.pickupCodeExpiresAt || order.pickupCodeExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "Pickup code has expired." },
        { status: 400 },
      );
    }

    const codeHash = createHash("sha256").update(code.trim()).digest("hex");

    if (codeHash !== order.pickupCodeHash) {
      const [updated] = await db
        .update(orders)
        .set({ pickupCodeAttempts: sql`${orders.pickupCodeAttempts} + 1` })
        .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
        .returning({ pickupCodeAttempts: orders.pickupCodeAttempts });

      const newAttempts =
        updated?.pickupCodeAttempts ?? order.pickupCodeAttempts + 1;
      return NextResponse.json(
        {
          error: "Invalid code.",
          attemptsRemaining: MAX_ATTEMPTS - newAttempts,
        },
        { status: 400 },
      );
    }

    // Load the order's payments (and the cook's connected account) up front so
    // we can refuse to complete an order whose money can't be collected BEFORE
    // handing the food over. Capture used to run after the fulfilled update and
    // silently skip any non-authorized payment, so an unpaid order could be
    // completed with the cook never getting paid.
    const payments = await db
      .select({
        id: orderPayments.id,
        type: orderPayments.type,
        status: orderPayments.status,
        stripePaymentIntentId: orderPayments.stripePaymentIntentId,
        cookPayoutAmount: orderPayments.cookPayoutAmount,
      })
      .from(orderPayments)
      .where(eq(orderPayments.orderId, orderId));

    // Cook's stripeAccountId — needed for the manual subscription transfer path.
    const [cookRow] = await db
      .select({ stripeAccountId: cookProfiles.stripeAccountId })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (findUncollectiblePayment(payments)) {
      return NextResponse.json(
        {
          error:
            "This order's payment hasn't been authorized, so it can't be completed. Ask the customer to complete payment first.",
        },
        { status: 402 },
      );
    }

    const fulfilledAt = new Date();
    const [fulfilled] = await db
      .update(orders)
      .set({
        status: "fulfilled",
        pickupCodeVerifiedAt: fulfilledAt,
        fulfilledAt,
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.cookId, cookId),
          eq(orders.status, "ready"),
        ),
      )
      .returning({ id: orders.id, fulfilledAt: orders.fulfilledAt });

    if (!fulfilled) {
      return NextResponse.json(
        { error: "Order is no longer awaiting pickup." },
        { status: 409 },
      );
    }

    // Thank-you email to the customer — fire and forget, non-blocking.
    db.select({
      clientEmail: authUser.email,
      clientFirstName: authUser.firstName,
      clientPhone: authUser.phone,
      clientPhoneVerified: authUser.phoneVerified,
      clientNotificationPreferences: authUser.notificationPreferences,
      totalPrice: orders.totalPrice,
      currency: orders.currency,
      pickupAt: orders.pickupAt,
      cookName: cookProfiles.displayName,
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
          })
          .from(orderDishes)
          .where(eq(orderDishes.orderId, orderId));
        return sendOrderCompletedEmailToClient(
          {
            email: row.clientEmail,
            firstName: row.clientFirstName,
            phone: row.clientPhone,
            phoneVerified: row.clientPhoneVerified,
            notificationPreferences: row.clientNotificationPreferences,
          },
          { name: row.cookName },
          {
            id: orderId,
            listingTitle: dishRows.map((d) => d.name).join(", "),
            quantity: dishRows.reduce((s, d) => s + d.quantity, 0),
            totalPrice: row.totalPrice,
            currency: row.currency,
            pickupAt: row.pickupAt,
          },
        );
      })
      .catch((err) => console.error("[verify-code/email]", err));

    // Release payment to cook based on payment type. Every non-deposit payment
    // here is guaranteed collectible (guarded above); deposit rows were already
    // released at confirmation, and `released` rows are idempotent no-ops.
    let fullPaymentReleased = false;

    for (const payment of payments) {
      if (payment.type === "deposit") continue; // deposit released at confirmation — skip

      if (!payment.stripePaymentIntentId) continue;

      if (payment.status === "authorized") {
        // One-time PI (full or balance) — capture and auto-transfer via transfer_data
        await capturePaymentIntent(
          payment.stripePaymentIntentId,
          `capture-${orderId}-${payment.type}`,
        );
        await db
          .update(orderPayments)
          .set({ status: "released", releasedAt: fulfilledAt })
          .where(
            and(
              eq(orderPayments.id, payment.id),
              eq(orderPayments.status, "authorized"),
            ),
          );
        if (payment.type === "full") fullPaymentReleased = true;
      } else if (payment.status === "held") {
        // Subscription payment: funds captured on platform, manually transfer cook's share
        if (payment.cookPayoutAmount && cookRow?.stripeAccountId) {
          const payoutCents = Math.round(
            parseFloat(payment.cookPayoutAmount) * 100,
          );
          const transferId = await createSubscriptionTransfer({
            amountCents: payoutCents,
            connectedAccountId: cookRow.stripeAccountId,
            idempotencyKey: `transfer-${orderId}`,
          });
          await db
            .update(orderPayments)
            .set({
              status: "released",
              stripeTransferId: transferId,
              releasedAt: fulfilledAt,
            })
            .where(
              and(
                eq(orderPayments.id, payment.id),
                eq(orderPayments.status, "held"),
              ),
            );
        }
      }
    }

    // Pay the platform-funded discount top-up once the full payment is released.
    // Best-effort + idempotent — never blocks the completed order on a subsidy
    // transfer failure.
    if (fullPaymentReleased) {
      await settleCookSubsidy(orderId);
    }

    return NextResponse.json({
      success: true,
      data: { orderId: fulfilled?.id, fulfilledAt: fulfilled?.fulfilledAt },
    });
  } catch (err) {
    console.error("[dashboard/orders/verify-code]", err);
    return NextResponse.json(
      { error: "Failed to verify pickup code." },
      { status: 500 },
    );
  }
}
