import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  authUser,
  cookProfiles,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import { sendOrderCancelledByClientEmailToCook } from "@/lib/emails/order-events";
import {
  guestAccessTokensMatch,
  hashGuestAccessToken,
} from "@/lib/guest-order-access";
import { isRefundEligible } from "@/lib/order-pricing";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  refundPaymentIntent,
} from "@/lib/stripe-payments";

const CANCELLABLE_STATUSES = ["pending", "confirmed"];

export type CancelOrderResult =
  | { ok: true; refunded: boolean }
  | { ok: false; status: number; error: string };

function refundEligibleForOrder(order: {
  pickupAt: Date | null;
  cookLeadTime: string | null;
  cancellationAllowed: boolean;
  status: string;
}): boolean {
  if (!order.cancellationAllowed) return false;
  if (!CANCELLABLE_STATUSES.includes(order.status)) return false;

  const pickupAt = order.pickupAt;

  if (!pickupAt && order.status === "pending") {
    return true;
  }

  return isRefundEligible(
    pickupAt instanceof Date ? pickupAt : pickupAt ? new Date(pickupAt) : null,
    order.cookLeadTime as Parameters<typeof isRefundEligible>[1],
    order.cancellationAllowed,
  );
}

export async function cancelClientOrder(
  orderId: string,
  clientId: string,
  cancelledBy: string,
): Promise<CancelOrderResult> {
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
    .where(and(eq(orders.id, orderId), eq(orders.clientId, clientId)))
    .limit(1);

  if (!order) {
    return { ok: false, status: 404, error: "Order not found." };
  }

  return executeCancellation(order, cancelledBy);
}

export async function cancelGuestOrderByToken(
  accessToken: string,
): Promise<CancelOrderResult & { orderId?: string }> {
  const token = accessToken.trim();
  if (!token) {
    return { ok: false, status: 400, error: "Invalid link." };
  }

  const tokenHash = hashGuestAccessToken(token);

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
      guestAccessTokenHash: orders.guestAccessTokenHash,
      cookLeadTime: cookProfiles.leadTime,
    })
    .from(orders)
    .leftJoin(cookProfiles, eq(orders.cookId, cookProfiles.id))
    .where(eq(orders.guestAccessTokenHash, tokenHash))
    .limit(1);

  if (
    !order?.guestAccessTokenHash ||
    !guestAccessTokensMatch(token, order.guestAccessTokenHash)
  ) {
    return { ok: false, status: 404, error: "Order not found." };
  }

  const result = await executeCancellation(order, order.clientId);
  return { ...result, orderId: order.id };
}

async function executeCancellation(
  order: {
    id: string;
    clientId: string;
    cookId: string;
    status: string;
    totalPrice: string;
    currency: string;
    pickupAt: Date | null;
    cancellationAllowed: boolean;
    cookLeadTime: string | null;
  },
  cancelledBy: string,
): Promise<CancelOrderResult> {
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return {
      ok: false,
      status: 400,
      error: "Order cannot be cancelled at this stage.",
    };
  }

  const refundEligible = refundEligibleForOrder(order);

  const payments = await db
    .select({
      id: orderPayments.id,
      status: orderPayments.status,
      stripePaymentIntentId: orderPayments.stripePaymentIntentId,
    })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, order.id));

  for (const payment of payments) {
    if (!payment.stripePaymentIntentId) continue;

    if (refundEligible) {
      if (payment.status === "authorized" || payment.status === "pending") {
        await cancelPaymentIntent(
          payment.stripePaymentIntentId,
          `client-cancel-${order.id}`,
        );
        await db
          .update(orderPayments)
          .set({ status: "refunded", refundedAt: new Date() })
          .where(eq(orderPayments.id, payment.id));
      } else if (payment.status === "held" || payment.status === "released") {
        const refundId = await refundPaymentIntent({
          paymentIntentId: payment.stripePaymentIntentId,
          idempotencyKey: `client-cancel-refund-${order.id}`,
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
      await capturePaymentIntent(
        payment.stripePaymentIntentId,
        `client-cancel-capture-${order.id}`,
      );
      await db
        .update(orderPayments)
        .set({ status: "released", releasedAt: new Date() })
        .where(eq(orderPayments.id, payment.id));
    } else if (payment.status === "pending") {
      await cancelPaymentIntent(
        payment.stripePaymentIntentId,
        `client-cancel-${order.id}`,
      );
      await db
        .update(orderPayments)
        .set({ status: "refunded", refundedAt: new Date() })
        .where(eq(orderPayments.id, payment.id));
    }
  }

  await db
    .update(orders)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy,
    })
    .where(eq(orders.id, order.id));

  db.select({
    cookEmail: authUser.email,
    cookFirstName: authUser.firstName,
  })
    .from(cookProfiles)
    .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
    .where(eq(cookProfiles.id, order.cookId))
    .limit(1)
    .then(async ([cookUser]) => {
      if (!cookUser) return;
      const [clientUser] = await db
        .select({
          firstName: authUser.firstName,
          lastName: authUser.lastName,
        })
        .from(authUser)
        .where(eq(authUser.id, order.clientId))
        .limit(1);
      const dishRows = await db
        .select({
          dishName: orderDishes.dishName,
          quantity: orderDishes.quantity,
        })
        .from(orderDishes)
        .where(eq(orderDishes.orderId, order.id));
      const qty = dishRows.reduce((s, d) => s + d.quantity, 0);
      const customerName =
        [clientUser?.firstName, clientUser?.lastName]
          .filter(Boolean)
          .join(" ") || "A customer";
      return sendOrderCancelledByClientEmailToCook(
        { email: cookUser.cookEmail, firstName: cookUser.cookFirstName },
        { name: customerName },
        {
          id: order.id,
          listingTitle: dishRows.map((d) => d.dishName).join(", "),
          quantity: qty,
          totalPrice: order.totalPrice,
          currency: order.currency,
          pickupAt: order.pickupAt,
        },
      );
    })
    .catch((err) => console.error("[cancelClientOrder] email", err));

  return { ok: true, refunded: refundEligible };
}
