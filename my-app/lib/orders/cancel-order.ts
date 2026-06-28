import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  authUser,
  cookProfiles,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import {
  sendOrderCancelledByClientEmailToClient,
  sendOrderCancelledByClientEmailToCook,
} from "@/lib/emails/order-events";
import {
  guestAccessTokensMatch,
  hashGuestAccessToken,
} from "@/lib/guest-order-access";
import { resolveOrderLeadTimeRules } from "@/lib/lead-time";
import {
  isClientOrderCancellable,
  isClientRefundEligible,
} from "@/lib/orders/client-cancel-policy";
import { settleCookSubsidy } from "@/lib/orders/settle-subsidy";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  refundPaymentIntent,
  reverseCookSubsidyTransfer,
} from "@/lib/stripe-payments";

export type CancelOrderResult =
  | { ok: true; refunded: boolean }
  | { ok: false; status: number; error: string };

export {
  getClientCancelPolicy,
  isClientOrderCancellable,
  isClientRefundEligible,
} from "@/lib/orders/client-cancel-policy";

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
      deliveryFeeSnapshot: orders.deliveryFeeSnapshot,
      taxAmount: orders.taxAmount,
      pickupAt: orders.pickupAt,
      fulfillmentWindowStart: orders.fulfillmentWindowStart,
      fulfillmentWindowEnd: orders.fulfillmentWindowEnd,
      cancellationAllowed: orders.cancellationAllowed,
      fulfillmentMode: orders.fulfillmentMode,
      confirmationCode: orders.confirmationCode,
      isGuestCheckout: orders.isGuestCheckout,
      leadTimeSnapshot: orders.leadTimeSnapshot,
      leadTimeCutoffSnapshot: orders.leadTimeCutoffSnapshot,
      cookLeadTime: cookProfiles.leadTime,
      cookLeadTimeCutoff: cookProfiles.leadTimeCutoff,
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
      deliveryFeeSnapshot: orders.deliveryFeeSnapshot,
      taxAmount: orders.taxAmount,
      pickupAt: orders.pickupAt,
      fulfillmentWindowStart: orders.fulfillmentWindowStart,
      fulfillmentWindowEnd: orders.fulfillmentWindowEnd,
      cancellationAllowed: orders.cancellationAllowed,
      fulfillmentMode: orders.fulfillmentMode,
      confirmationCode: orders.confirmationCode,
      isGuestCheckout: orders.isGuestCheckout,
      guestAccessTokenHash: orders.guestAccessTokenHash,
      leadTimeSnapshot: orders.leadTimeSnapshot,
      leadTimeCutoffSnapshot: orders.leadTimeCutoffSnapshot,
      cookLeadTime: cookProfiles.leadTime,
      cookLeadTimeCutoff: cookProfiles.leadTimeCutoff,
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

  const result = await executeCancellation(order, order.clientId, {
    guestAccessToken: token,
  });
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
    deliveryFeeSnapshot: string | null;
    taxAmount: string | null;
    pickupAt: Date | null;
    fulfillmentWindowStart: Date | null;
    fulfillmentWindowEnd: Date | null;
    cancellationAllowed: boolean;
    fulfillmentMode: string | null;
    confirmationCode: string | null;
    isGuestCheckout: boolean;
    leadTimeSnapshot: string | null;
    leadTimeCutoffSnapshot: string | null;
    cookLeadTime: string | null;
    cookLeadTimeCutoff: string | null;
  },
  cancelledBy: string,
  options?: { guestAccessToken?: string },
): Promise<CancelOrderResult> {
  if (!isClientOrderCancellable(order)) {
    return {
      ok: false,
      status: 400,
      error: "Order cannot be cancelled at this stage.",
    };
  }

  const leadTimeRules = resolveOrderLeadTimeRules(order);

  const refundEligible = isClientRefundEligible({
    status: order.status,
    cancellationAllowed: order.cancellationAllowed,
    pickupAt: order.pickupAt,
    fulfillmentWindowStart: order.fulfillmentWindowStart,
    cookLeadTime: leadTimeRules.leadTime,
    cookLeadTimeCutoff: leadTimeRules.leadTimeCutoff,
    fulfillmentMode:
      order.fulfillmentMode === "delivery" || order.fulfillmentMode === "pickup"
        ? order.fulfillmentMode
        : null,
  });
  let clientRefunded = false;

  const payments = await db
    .select({
      id: orderPayments.id,
      type: orderPayments.type,
      status: orderPayments.status,
      stripePaymentIntentId: orderPayments.stripePaymentIntentId,
      stripeTopupTransferId: orderPayments.stripeTopupTransferId,
    })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, order.id));

  let fullPaymentReleased = false;

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
        clientRefunded = true;
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
        clientRefunded = true;
        // If the full payment had a platform-funded subsidy top-up, claw it back
        // so the platform isn't out of pocket when the customer is refunded.
        // Refunds before capture leave stripeTopupTransferId null — skip those.
        if (payment.type === "full" && payment.stripeTopupTransferId) {
          try {
            await reverseCookSubsidyTransfer({
              transferId: payment.stripeTopupTransferId,
              idempotencyKey: `subsidy-reversal-${order.id}`,
            });
          } catch (err) {
            console.error(
              `[cancelClientOrder] failed to reverse subsidy top-up for order ${order.id}`,
              err,
            );
          }
        }
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
      if (payment.type === "full") fullPaymentReleased = true;
    }
  }

  // Not-refund-eligible cancel captured+released the full payment to the cook —
  // pay any platform-funded discount top-up too (best-effort, idempotent).
  if (fullPaymentReleased) {
    await settleCookSubsidy(order.id);
  }

  await db
    .update(orders)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy,
    })
    .where(eq(orders.id, order.id));

  try {
    await notifyOfClientCancellation(order, clientRefunded, options);
  } catch (err) {
    console.error("[cancelClientOrder] email", err);
  }

  return { ok: true, refunded: clientRefunded };
}

async function notifyOfClientCancellation(
  order: {
    id: string;
    clientId: string;
    cookId: string;
    totalPrice: string;
    currency: string;
    deliveryFeeSnapshot: string | null;
    taxAmount: string | null;
    pickupAt: Date | null;
    fulfillmentWindowStart: Date | null;
    fulfillmentWindowEnd: Date | null;
    fulfillmentMode: string | null;
    confirmationCode: string | null;
    isGuestCheckout: boolean;
  },
  refunded: boolean,
  options?: { guestAccessToken?: string },
): Promise<void> {
  const [cookUser] = await db
    .select({
      cookEmail: authUser.email,
      cookFirstName: authUser.firstName,
      cookDisplayName: cookProfiles.displayName,
    })
    .from(cookProfiles)
    .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
    .where(eq(cookProfiles.id, order.cookId))
    .limit(1);

  if (!cookUser) return;

  const [clientUser] = await db
    .select({
      email: authUser.email,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      phone: authUser.phone,
      phoneVerified: authUser.phoneVerified,
      notificationPreferences: authUser.notificationPreferences,
    })
    .from(authUser)
    .where(eq(authUser.id, order.clientId))
    .limit(1);

  const dishRows = await db
    .select({
      dishName: orderDishes.dishName,
      quantity: orderDishes.quantity,
      lineTotal: orderDishes.lineTotal,
      discountAmount: orderDishes.discountAmount,
      sortOrder: orderDishes.sortOrder,
    })
    .from(orderDishes)
    .where(eq(orderDishes.orderId, order.id));
  const orderedDishes = [...dishRows].sort((a, b) => a.sortOrder - b.sortOrder);

  const qty = orderedDishes.reduce((s, d) => s + d.quantity, 0);
  const customerName =
    [clientUser?.firstName, clientUser?.lastName].filter(Boolean).join(" ") ||
    "A customer";
  const cookName = cookUser.cookDisplayName ?? "Your cook";
  const fulfillmentMode: "pickup" | "delivery" | null =
    order.fulfillmentMode === "delivery" || order.fulfillmentMode === "pickup"
      ? order.fulfillmentMode
      : null;

  const orderEmail = {
    id: order.id,
    listingTitle: orderedDishes.map((d) => d.dishName).join(", "),
    quantity: qty,
    totalPrice: order.totalPrice,
    currency: order.currency,
    pickupAt: order.pickupAt,
    fulfillmentMode,
    fulfillmentWindowStart: order.fulfillmentWindowStart,
    fulfillmentWindowEnd: order.fulfillmentWindowEnd,
    items: orderedDishes.map((d) => ({
      name: d.dishName,
      quantity: d.quantity,
      lineTotal: d.lineTotal,
      discountAmount: d.discountAmount,
    })),
    deliveryFee: order.deliveryFeeSnapshot,
    taxAmount: order.taxAmount,
  };

  await sendOrderCancelledByClientEmailToCook(
    { email: cookUser.cookEmail, firstName: cookUser.cookFirstName },
    { name: customerName },
    orderEmail,
    { refunded },
  );

  if (clientUser?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const receiptUrl =
      options?.guestAccessToken && appUrl
        ? `${appUrl}/app/checkout/guest-confirmation?token=${encodeURIComponent(options.guestAccessToken)}`
        : null;

    await sendOrderCancelledByClientEmailToClient(
      {
        email: clientUser.email,
        firstName: clientUser.firstName,
        phone: clientUser.phone,
        phoneVerified: clientUser.phoneVerified,
        notificationPreferences: clientUser.notificationPreferences,
      },
      { name: cookName },
      orderEmail,
      {
        refunded,
        confirmationCode: order.confirmationCode,
        isGuestCheckout: order.isGuestCheckout,
        receiptUrl,
      },
    );
  }
}
