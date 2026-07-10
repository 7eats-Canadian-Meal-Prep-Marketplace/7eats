import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { orderPayments, orders } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  cancelClientPendingCheckouts,
  isUnpaidCheckoutPayment,
} from "@/lib/orders/abandoned-checkout";
import { getStripe } from "@/lib/stripe";

const bodySchema = z.object({
  cookId: z.string().uuid().optional(),
  resumeOrderId: z.string().uuid().optional(),
});

async function loadResumableCheckout(
  clientId: string,
  orderId: string,
  cookId?: string,
) {
  const [row] = await db
    .select({
      orderId: orders.id,
      cookId: orders.cookId,
      orderStatus: orders.status,
      paymentStatus: orderPayments.status,
      stripePaymentIntentId: orderPayments.stripePaymentIntentId,
      isGuestCheckout: orders.isGuestCheckout,
    })
    .from(orders)
    .innerJoin(
      orderPayments,
      and(eq(orderPayments.orderId, orders.id), eq(orderPayments.type, "full")),
    )
    .where(and(eq(orders.id, orderId), eq(orders.clientId, clientId)))
    .limit(1);

  if (!row) return null;
  if (
    row.orderStatus !== "pending" ||
    !isUnpaidCheckoutPayment(row.paymentStatus)
  ) {
    return null;
  }
  if (cookId && row.cookId !== cookId) return null;
  if (!row.stripePaymentIntentId) return null;

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(row.stripePaymentIntentId);
  if (!pi.client_secret) return null;

  const payableStatuses = new Set([
    "requires_payment_method",
    "requires_confirmation",
    "requires_action",
    "requires_capture",
  ]);
  if (!payableStatuses.has(pi.status)) return null;

  return {
    orderId: row.orderId,
    clientSecret: pi.client_secret,
    paymentIntentStatus: pi.status,
    isGuestCheckout: row.isGuestCheckout,
  };
}

/** Release stale checkout holds and optionally resume the in-progress session. */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "client") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { cookId, resumeOrderId } = parsed.data;

  let resumed: {
    orderId: string;
    clientSecret: string;
    paymentIntentStatus: string;
    isGuestCheckout: boolean;
  } | null = null;

  if (resumeOrderId) {
    try {
      resumed = await loadResumableCheckout(
        session.user.id,
        resumeOrderId,
        cookId,
      );
    } catch (err) {
      console.error("[checkout/prepare] resume", err);
    }
  }

  try {
    const cancelled = await cancelClientPendingCheckouts(session.user.id, {
      exceptOrderId: resumed?.orderId,
    });

    return NextResponse.json({
      success: true,
      data: {
        resumed,
        cancelledOrderIds: cancelled,
      },
    });
  } catch (err) {
    console.error("[checkout/prepare]", err);
    return NextResponse.json(
      { error: "Could not prepare checkout." },
      { status: 500 },
    );
  }
}
