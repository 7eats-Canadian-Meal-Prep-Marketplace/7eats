import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  authUser,
  cookProfiles,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import { formatPickupLocation } from "@/lib/address";
import { sendCookNewOrderSms } from "@/lib/cook-order-notifications";
import {
  sendGuestOrderReceiptToClient,
  sendOrderPlacedEmailToCook,
  sendOrderReceiptToClient,
} from "@/lib/emails/order-events";
import { guestAccessTokensMatch } from "@/lib/guest-order-access";
import { getStripe } from "@/lib/stripe";

export type ConfirmPaymentResult =
  | { ok: true; alreadyAuthorized?: boolean }
  | { ok: false; status: number; error: string };

async function sendOrderConfirmationEmails(
  orderId: string,
  guestAccessToken?: string,
): Promise<void> {
  const [orderRow] = await db
    .select({
      id: orders.id,
      totalPrice: orders.totalPrice,
      currency: orders.currency,
      deliveryFeeSnapshot: orders.deliveryFeeSnapshot,
      taxAmount: orders.taxAmount,
      pickupAt: orders.pickupAt,
      fulfillmentMode: orders.fulfillmentMode,
      fulfillmentWindowStart: orders.fulfillmentWindowStart,
      fulfillmentWindowEnd: orders.fulfillmentWindowEnd,
      cancellationAllowed: orders.cancellationAllowed,
      isGuestCheckout: orders.isGuestCheckout,
      confirmationCode: orders.confirmationCode,
      clientId: orders.clientId,
      cookId: orders.cookId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return;

  const dishRows = await db
    .select({
      dishName: orderDishes.dishName,
      quantity: orderDishes.quantity,
      lineTotal: orderDishes.lineTotal,
      discountAmount: orderDishes.discountAmount,
      sortOrder: orderDishes.sortOrder,
    })
    .from(orderDishes)
    .where(eq(orderDishes.orderId, orderId));
  const orderedDishes = [...dishRows].sort((a, b) => a.sortOrder - b.sortOrder);

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
    .where(eq(authUser.id, orderRow.clientId))
    .limit(1);

  const [cookRow] = await db
    .select({
      displayName: cookProfiles.displayName,
      cookEmail: authUser.email,
      cookFirstName: authUser.firstName,
      cookPhone: authUser.phone,
      cookPhoneVerified: authUser.phoneVerified,
      emailNotificationsNewOrder: cookProfiles.emailNotificationsNewOrder,
      smsNotificationsNewOrder: cookProfiles.smsNotificationsNewOrder,
      pickupStreet: cookProfiles.pickupStreet,
      pickupUnit: cookProfiles.pickupUnit,
      pickupCity: cookProfiles.pickupCity,
      pickupProvince: cookProfiles.pickupProvince,
      pickupPostal: cookProfiles.pickupPostal,
    })
    .from(cookProfiles)
    .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
    .where(eq(cookProfiles.id, orderRow.cookId))
    .limit(1);

  if (!clientUser || !cookRow) return;

  const listingTitle = orderedDishes.map((d) => d.dishName).join(", ");
  const totalQty = orderedDishes.reduce((sum, d) => sum + d.quantity, 0);
  const displayName =
    [clientUser.firstName, clientUser.lastName].filter(Boolean).join(" ") ||
    clientUser.email;

  const pickupLocation =
    orderRow.fulfillmentMode === "pickup"
      ? formatPickupLocation({
          street: cookRow.pickupStreet,
          unit: cookRow.pickupUnit,
          city: cookRow.pickupCity,
          province: cookRow.pickupProvince,
          postal: cookRow.pickupPostal,
        })
      : null;

  const orderEmailPayload = {
    id: orderId,
    listingTitle,
    quantity: totalQty,
    pickupLocation,
    totalPrice: orderRow.totalPrice,
    currency: orderRow.currency ?? "CAD",
    pickupAt: orderRow.pickupAt,
    fulfillmentMode: orderRow.fulfillmentMode as "pickup" | "delivery" | null,
    fulfillmentWindowStart: orderRow.fulfillmentWindowStart,
    fulfillmentWindowEnd: orderRow.fulfillmentWindowEnd,
    items: orderedDishes.map((d) => ({
      name: d.dishName,
      quantity: d.quantity,
      lineTotal: d.lineTotal,
      discountAmount: d.discountAmount,
    })),
    deliveryFee: orderRow.deliveryFeeSnapshot,
    taxAmount: orderRow.taxAmount,
  };

  if (cookRow.emailNotificationsNewOrder) {
    sendOrderPlacedEmailToCook(
      { email: cookRow.cookEmail, firstName: cookRow.cookFirstName },
      { name: displayName },
      orderEmailPayload,
    ).catch((err) => console.error("[confirmOrderPayment] cook email", err));
  }

  sendCookNewOrderSms(
    {
      phone: cookRow.cookPhone,
      phoneVerified: cookRow.cookPhoneVerified,
      smsNotificationsNewOrder: cookRow.smsNotificationsNewOrder,
    },
    displayName,
    listingTitle,
  ).catch((err) => console.error("[confirmOrderPayment] cook sms", err));

  if (
    orderRow.isGuestCheckout &&
    guestAccessToken &&
    orderRow.confirmationCode
  ) {
    sendGuestOrderReceiptToClient(
      { email: clientUser.email, firstName: clientUser.firstName },
      { name: cookRow.displayName ?? "your cook" },
      {
        ...orderEmailPayload,
        cancellationAllowed: orderRow.cancellationAllowed,
      },
      {
        confirmationCode: orderRow.confirmationCode,
        accessToken: guestAccessToken,
      },
    ).catch((err) => console.error("[confirmOrderPayment] guest receipt", err));
  } else {
    sendOrderReceiptToClient(
      {
        email: clientUser.email,
        firstName: clientUser.firstName,
        phone: clientUser.phone,
        phoneVerified: clientUser.phoneVerified,
        notificationPreferences: clientUser.notificationPreferences,
      },
      { name: cookRow.displayName ?? "your cook" },
      orderEmailPayload,
    ).catch((err) => console.error("[confirmOrderPayment] receipt", err));
  }
}

/** Mark a pending order payment authorized once Stripe reports capturable funds. */
export async function markOrderPaymentAuthorized(
  stripePaymentIntentId: string,
  opts: { sendEmails?: boolean; guestAccessToken?: string } = {},
): Promise<{ ok: boolean; alreadyAuthorized?: boolean }> {
  const [payment] = await db
    .select({
      id: orderPayments.id,
      orderId: orderPayments.orderId,
      status: orderPayments.status,
    })
    .from(orderPayments)
    .where(eq(orderPayments.stripePaymentIntentId, stripePaymentIntentId))
    .limit(1);

  if (!payment) return { ok: false };
  if (payment.status === "authorized") {
    return { ok: true, alreadyAuthorized: true };
  }
  if (payment.status !== "pending") return { ok: false };

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
  if (pi.status !== "requires_capture") return { ok: false };

  // Persist the authorization charge id so the charge.refunded webhook can match
  // this order (and reverse any platform subsidy top-up) for out-of-band refunds.
  const stripeChargeId =
    typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : (pi.latest_charge?.id ?? null);

  const updated = await db
    .update(orderPayments)
    .set({ status: "authorized", authorizedAt: new Date(), stripeChargeId })
    .where(
      and(
        eq(orderPayments.id, payment.id),
        eq(orderPayments.status, "pending"),
      ),
    )
    .returning({ id: orderPayments.id });

  if (updated.length === 0) {
    return { ok: true, alreadyAuthorized: true };
  }

  if (opts.sendEmails !== false) {
    await sendOrderConfirmationEmails(payment.orderId, opts.guestAccessToken);
  }

  return { ok: true };
}

export async function confirmClientOrderPayment(
  orderId: string,
  clientId: string | null,
  guestAccessToken?: string,
): Promise<ConfirmPaymentResult> {
  const [order] = await db
    .select({
      id: orders.id,
      clientId: orders.clientId,
      guestAccessTokenHash: orders.guestAccessTokenHash,
      isGuestCheckout: orders.isGuestCheckout,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { ok: false, status: 404, error: "Order not found." };
  }

  if (order.isGuestCheckout) {
    if (!guestAccessToken) {
      return { ok: false, status: 400, error: "Guest access token required." };
    }
    if (
      !order.guestAccessTokenHash ||
      !guestAccessTokensMatch(guestAccessToken, order.guestAccessTokenHash)
    ) {
      return { ok: false, status: 403, error: "Invalid guest access token." };
    }
  } else if (!clientId || order.clientId !== clientId) {
    return { ok: false, status: 403, error: "Access denied." };
  }

  const [payment] = await db
    .select({
      stripePaymentIntentId: orderPayments.stripePaymentIntentId,
      status: orderPayments.status,
    })
    .from(orderPayments)
    .where(
      and(eq(orderPayments.orderId, orderId), eq(orderPayments.type, "full")),
    )
    .limit(1);

  if (!payment?.stripePaymentIntentId) {
    return { ok: false, status: 404, error: "Payment not found." };
  }

  if (payment.status === "authorized") {
    return { ok: true, alreadyAuthorized: true };
  }

  const result = await markOrderPaymentAuthorized(
    payment.stripePaymentIntentId,
    { guestAccessToken },
  );

  if (!result.ok) {
    return {
      ok: false,
      status: 402,
      error:
        "Payment has not been authorized yet. Complete payment and try again.",
    };
  }

  return { ok: true, alreadyAuthorized: result.alreadyAuthorized };
}
