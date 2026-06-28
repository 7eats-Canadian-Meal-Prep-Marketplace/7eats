import { sendMail } from "@/lib/email";
import {
  deliverOrderClientUpdate,
  type OrderNotifyClient,
} from "@/lib/order-client-notifications";
import { formatOrderTimingLabel } from "@/lib/order-timing-label";
import {
  bulletList,
  contactParagraph,
  contactTextLine,
  escapeHtml,
  htmlEmail,
  orderDetailsTable,
  orderSummaryTable,
  paragraph,
  pickupCodeBlock,
} from "./base";

type OrderEmailItem = {
  name: string;
  quantity: number;
  lineTotal?: string | null;
  discountAmount?: string | null;
};

type OrderEmailData = {
  id: string;
  listingTitle: string;
  quantity: number;
  totalPrice: string;
  currency: string;
  pickupAt: Date | string | null;
  fulfillmentMode?: "pickup" | "delivery" | null;
  fulfillmentWindowStart?: Date | string | null;
  fulfillmentWindowEnd?: Date | string | null;
  // Per-dish breakdown for the itemised summary. When absent, client emails
  // fall back to the flat `listingTitle` + `totalPrice` rows.
  items?: OrderEmailItem[];
  deliveryFee?: string | number | null;
  taxAmount?: string | number | null;
  taxLabel?: string | null;
  // Cook's pickup address, shown to the client for pickup orders only. Composed
  // upstream via formatPickupLocation(); null/absent for delivery or unknown.
  pickupLocation?: string | null;
};

function fulfillmentLabel(mode: OrderEmailData["fulfillmentMode"]): string {
  return mode === "delivery" ? "Delivery" : "Pickup";
}

function formatTiming(order: OrderEmailData): string {
  return formatOrderTimingLabel(order);
}

/** Short clock string for the cook's approximate delivery arrival, e.g. "5:30 p.m.". */
function arrivalClock(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Omit TBD — cancelled orders don't need a vague timing line. */
function knownTimingLabel(order: OrderEmailData): string | null {
  const timing = formatTiming(order);
  return timing === "TBD" || timing === "Date to be confirmed" ? null : timing;
}

function emailTimingRow(
  order: OrderEmailData,
): { label: string; value: string } | null {
  const timing = knownTimingLabel(order);
  if (!timing) return null;
  return { label: fulfillmentLabel(order.fulfillmentMode), value: timing };
}

/**
 * Pickup-address row for the order-details table. Pickup orders only — delivery
 * has its own hand-off copy. Returns null when the mode is delivery or no
 * address is known, so the row is simply omitted. The value is HTML-escaped
 * because `orderDetailsTable` inserts it verbatim and addresses are cook-entered.
 */
function pickupLocationRow(
  order: OrderEmailData,
): { label: string; value: string } | null {
  if (order.fulfillmentMode === "delivery") return null;
  const location = order.pickupLocation?.trim();
  if (!location) return null;
  return { label: "Pickup location", value: escapeHtml(location) };
}

/** Plain-text counterpart of pickupLocationRow; raw (unescaped) for text email. */
function pickupLocationTextLine(order: OrderEmailData): string | null {
  if (order.fulfillmentMode === "delivery") return null;
  const location = order.pickupLocation?.trim();
  return location ? `Pickup location: ${location}` : null;
}

function cancellationScheduleClause(order: OrderEmailData): string {
  const timing = knownTimingLabel(order);
  return timing ? ` scheduled for ${timing}` : "";
}

function formatMoney(total: string, currency: string): string {
  return `$${total} ${currency}`;
}

function hasItemizedSummary(
  order: OrderEmailData,
): order is OrderEmailData & { items: OrderEmailItem[] } {
  return Array.isArray(order.items) && order.items.length > 0;
}

/**
 * Itemised order summary for client emails. Renders the rich per-dish table
 * when line items are available, otherwise falls back to the flat
 * Items + Total rows so older callers keep working.
 */
function orderSummaryHtml(order: OrderEmailData): string {
  if (hasItemizedSummary(order)) {
    return orderSummaryTable({
      items: order.items,
      deliveryFee: order.deliveryFee != null ? Number(order.deliveryFee) : 0,
      tax: order.taxAmount != null ? Number(order.taxAmount) : 0,
      taxLabel: order.taxLabel,
      total: order.totalPrice,
      currency: order.currency,
    });
  }
  return orderDetailsTable([
    { label: "Items", value: order.listingTitle },
    { label: "Total", value: formatMoney(order.totalPrice, order.currency) },
  ]);
}

function orderSummaryText(order: OrderEmailData): string[] {
  if (!hasItemizedSummary(order)) {
    return [
      `Items: ${order.listingTitle}`,
      `Total: ${formatMoney(order.totalPrice, order.currency)}`,
    ];
  }
  const itemLines = order.items.map((it) => {
    const price =
      it.lineTotal != null && it.lineTotal !== ""
        ? `  $${Number(it.lineTotal).toFixed(2)}`
        : "";
    return `  ${it.quantity}× ${it.name}${price}`;
  });
  const subtotal = order.items.reduce(
    (sum, it) => sum + Number(it.lineTotal ?? 0),
    0,
  );
  const deliveryFee = order.deliveryFee != null ? Number(order.deliveryFee) : 0;
  const tax = order.taxAmount != null ? Number(order.taxAmount) : 0;
  return [
    "Items:",
    ...itemLines,
    `Subtotal: $${subtotal.toFixed(2)}`,
    ...(deliveryFee > 0 ? [`Delivery: $${deliveryFee.toFixed(2)}`] : []),
    ...(tax > 0 ? [`${order.taxLabel ?? "Tax"}: $${tax.toFixed(2)}`] : []),
    `Total: ${formatMoney(order.totalPrice, order.currency)}`,
  ];
}

function greeting(firstName: string | null): string {
  return firstName ? `Hi ${firstName},` : "Hi,";
}

function textWithContact(lines: string[]): string {
  return [...lines, "", contactTextLine()].join("\n");
}

export type OrderClientRecipient = {
  email: string;
  firstName: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
  notificationPreferences?: unknown;
};

function orderClientRecipient(client: OrderClientRecipient): OrderNotifyClient {
  return {
    email: client.email,
    firstName: client.firstName,
    phone: client.phone ?? null,
    phoneVerified: client.phoneVerified ?? false,
    notificationPreferences: client.notificationPreferences,
  };
}

export async function sendOrderPlacedEmailToCook(
  cook: { email: string; firstName: string | null },
  customer: { name: string },
  order: OrderEmailData,
): Promise<void> {
  try {
    const timing = formatTiming(order);
    const subject = `New order from ${customer.name}: ${order.listingTitle}`;
    const html = htmlEmail({
      title: subject,
      preheader: `${customer.name} ordered ${order.listingTitle}.`,
      bodyHtml:
        paragraph(greeting(cook.firstName)) +
        paragraph(`${customer.name} just placed an order.`) +
        orderDetailsTable([
          { label: "Order", value: order.listingTitle },
          { label: "Quantity", value: String(order.quantity) },
          {
            label: "Total",
            value: formatMoney(order.totalPrice, order.currency),
          },
          { label: fulfillmentLabel(order.fulfillmentMode), value: timing },
        ]) +
        paragraph(
          "Review it in your dashboard and confirm when you're ready.",
        ) +
        contactParagraph(),
      ctaLabel: "View order",
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/business/orders`,
    });
    const text = textWithContact([
      greeting(cook.firstName),
      "",
      `${customer.name} just placed an order.`,
      "",
      `Order: ${order.listingTitle}`,
      `Quantity: ${order.quantity}`,
      `Total: ${formatMoney(order.totalPrice, order.currency)}`,
      `Fulfillment: ${fulfillmentLabel(order.fulfillmentMode)}`,
      `Timing: ${timing}`,
      "",
      "Review it in your dashboard and confirm when you're ready.",
      `${process.env.NEXT_PUBLIC_APP_URL}/business/orders`,
    ]);
    await sendMail({ to: cook.email, subject, text, html });
  } catch (err) {
    console.error("[email/order-placed-cook]", err);
  }
}

export async function sendOrderReceiptToClient(
  client: OrderClientRecipient,
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
  await deliverOrderClientUpdate(
    orderClientRecipient(client),
    async () => {
      try {
        const timing = formatTiming(order);
        const pickupRow = pickupLocationRow(order);
        const pickupTextLine = pickupLocationTextLine(order);
        const subject = `Your 7eats order with ${cook.name} is confirmed`;
        const html = htmlEmail({
          title: subject,
          preheader: `We received your order from ${cook.name}.`,
          bodyHtml:
            paragraph(greeting(client.firstName)) +
            paragraph(
              `Thanks for your order with <strong>${cook.name}</strong>.`,
            ) +
            orderSummaryHtml(order) +
            orderDetailsTable([
              {
                label: "Fulfillment",
                value: fulfillmentLabel(order.fulfillmentMode),
              },
              { label: "Timing", value: timing },
              ...(pickupRow ? [pickupRow] : []),
            ]) +
            paragraph(
              "You can track its status and pickup code any time from your orders.",
            ) +
            contactParagraph(),
          ctaLabel: "View your order",
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/app/orders/${order.id}`,
        });
        const text = textWithContact([
          greeting(client.firstName),
          "",
          `Thanks for your order with ${cook.name}.`,
          "",
          ...orderSummaryText(order),
          "",
          `Fulfillment: ${fulfillmentLabel(order.fulfillmentMode)}`,
          `Timing: ${timing}`,
          ...(pickupTextLine ? [pickupTextLine] : []),
          "",
          "Track it any time from your orders:",
          `${process.env.NEXT_PUBLIC_APP_URL}/app/orders/${order.id}`,
        ]);
        await sendMail({ to: client.email, subject, text, html });
      } catch (err) {
        console.error("[email/order-receipt-client]", err);
      }
    },
    `7eats: Order confirmed with ${cook.name}. Track it in the app.`,
  );
}

export async function sendGuestOrderReceiptToClient(
  client: { email: string; firstName: string | null },
  cook: { name: string },
  order: OrderEmailData & { cancellationAllowed?: boolean },
  guest: { confirmationCode: string; accessToken: string },
): Promise<void> {
  try {
    const timing = formatTiming(order);
    const pickupRow = pickupLocationRow(order);
    const pickupTextLine = pickupLocationTextLine(order);
    const receiptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/app/checkout/guest-confirmation?token=${encodeURIComponent(guest.accessToken)}`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/app/guest/order/cancel?token=${encodeURIComponent(guest.accessToken)}`;
    const subject = `Order confirmed - ${guest.confirmationCode}`;
    const cancelNote = order.cancellationAllowed
      ? paragraph(
          `<a href="${cancelUrl}" style="color:#0f0f0f;font-weight:700;">Cancel this order</a> (while it is still pending).`,
        )
      : paragraph(
          "This cook does not accept cancellations - all sales are final.",
        );

    const html = htmlEmail({
      title: subject,
      preheader: `Your order with ${cook.name} is confirmed. Code: ${guest.confirmationCode}`,
      bodyHtml:
        paragraph(greeting(client.firstName)) +
        paragraph(`Thanks for your order with <strong>${cook.name}</strong>.`) +
        orderSummaryHtml(order) +
        orderDetailsTable([
          { label: "Confirmation code", value: guest.confirmationCode },
          {
            label: "Fulfillment",
            value: fulfillmentLabel(order.fulfillmentMode),
          },
          { label: "Timing", value: timing },
          ...(pickupRow ? [pickupRow] : []),
        ]) +
        paragraph(
          "Save your confirmation code if you need to contact support.",
        ) +
        cancelNote +
        contactParagraph(),
      ctaLabel: "View receipt",
      ctaUrl: receiptUrl,
    });

    const text = textWithContact([
      greeting(client.firstName),
      "",
      `Thanks for your order with ${cook.name}.`,
      "",
      ...orderSummaryText(order),
      "",
      `Confirmation code: ${guest.confirmationCode}`,
      `Fulfillment: ${fulfillmentLabel(order.fulfillmentMode)}`,
      `Timing: ${timing}`,
      ...(pickupTextLine ? [pickupTextLine] : []),
      "",
      "Save your confirmation code if you need to contact support.",
      "",
      `View receipt: ${receiptUrl}`,
      ...(order.cancellationAllowed ? ["", `Cancel order: ${cancelUrl}`] : []),
    ]);
    await sendMail({
      to: client.email,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("[email/guest-order-receipt]", err);
  }
}

export async function sendOrderConfirmedEmailToClient(
  client: OrderClientRecipient,
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
  await deliverOrderClientUpdate(
    orderClientRecipient(client),
    async () => {
      try {
        const timing = formatTiming(order);
        const pickupRow = pickupLocationRow(order);
        const pickupTextLine = pickupLocationTextLine(order);
        const subject = "Your order is confirmed";
        const html = htmlEmail({
          title: subject,
          preheader: `${cook.name} confirmed your order.`,
          bodyHtml:
            paragraph(greeting(client.firstName)) +
            paragraph(`${cook.name} confirmed your order. See you at pickup.`) +
            orderSummaryHtml(order) +
            orderDetailsTable([
              { label: fulfillmentLabel(order.fulfillmentMode), value: timing },
              ...(pickupRow ? [pickupRow] : []),
            ]) +
            paragraph(
              "You'll get another email with your pickup code once the order is ready.",
            ) +
            contactParagraph(),
        });
        const text = textWithContact([
          greeting(client.firstName),
          "",
          `${cook.name} confirmed your order. See you at pickup.`,
          "",
          ...orderSummaryText(order),
          "",
          `${fulfillmentLabel(order.fulfillmentMode)}: ${timing}`,
          ...(pickupTextLine ? [pickupTextLine] : []),
          "",
          "You'll get another email with your pickup code once the order is ready.",
        ]);
        await sendMail({ to: client.email, subject, text, html });
      } catch (err) {
        console.error("[email/order-confirmed-client]", err);
      }
    },
    `7eats: ${cook.name} confirmed your order. We'll notify you when it's ready.`,
  );
}

export async function sendOrderNotReadyEmailToClient(
  client: OrderClientRecipient,
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
  await deliverOrderClientUpdate(
    orderClientRecipient(client),
    async () => {
      try {
        const timingRow = emailTimingRow(order);
        const pickupRow = pickupLocationRow(order);
        const pickupTextLine = pickupLocationTextLine(order);
        const codeNoun =
          order.fulfillmentMode === "delivery"
            ? "delivery code"
            : "pickup code";
        const subject = `Your order from ${cook.name} is taking a little longer`;
        const html = htmlEmail({
          title: subject,
          preheader: `${cook.name} is still preparing your order.`,
          bodyHtml:
            paragraph(greeting(client.firstName)) +
            paragraph(
              `Quick heads up. Your order from <strong>${cook.name}</strong> is taking a little longer than expected. They're still hard at work on it and will have it ready as soon as they can.`,
            ) +
            orderDetailsTable([
              { label: "Order", value: order.listingTitle },
              ...(timingRow ? [timingRow] : []),
              ...(pickupRow ? [pickupRow] : []),
            ]) +
            paragraph(
              `No need to do anything. We'll email you a fresh ${codeNoun} the moment it's ready. Thanks for your patience!`,
            ) +
            contactParagraph(),
        });
        const text = textWithContact([
          greeting(client.firstName),
          "",
          `Quick heads up. Your order from ${cook.name} is taking a little longer than expected. They're still hard at work on it and will have it ready as soon as they can.`,
          "",
          `Order: ${order.listingTitle}`,
          ...(timingRow ? [`${timingRow.label}: ${timingRow.value}`] : []),
          ...(pickupTextLine ? [pickupTextLine] : []),
          "",
          `No need to do anything. We'll email you a fresh ${codeNoun} the moment it's ready. Thanks for your patience!`,
        ]);
        await sendMail({ to: client.email, subject, text, html });
      } catch (err) {
        console.error("[email/order-not-ready-client]", err);
      }
    },
    `7eats: Your order from ${cook.name} is taking a little longer. We'll notify you when it's ready.`,
  );
}

export async function sendOrderReadyEmailToClient(
  client: OrderClientRecipient,
  cook: { name: string },
  order: OrderEmailData,
  pickupCode: string,
): Promise<void> {
  const isDelivery = order.fulfillmentMode === "delivery";
  const codeLabel = isDelivery ? "Delivery code" : "Pickup code";
  const arrival = isDelivery ? arrivalClock(order.pickupAt) : null;

  // Delivery hand-off guidance: an approximate ETA, and a person must be there
  // to receive the order and hand over the code (it's never left at the door).
  const deliveryTips = [
    arrival
      ? `Have someone available at the delivery address around ${arrival} to receive the order.`
      : "Have someone available at the delivery address to receive the order.",
    "Have your delivery code ready. Your cook needs it to confirm the hand-off.",
    "This isn't a leave-at-door drop-off; a person must be there to collect it.",
  ];
  const deliveryTipsText = deliveryTips.map((t) => `• ${t}`);

  await deliverOrderClientUpdate(
    orderClientRecipient(client),
    async () => {
      try {
        const timingRow = emailTimingRow(order);
        const pickupRow = pickupLocationRow(order);
        const pickupTextLine = pickupLocationTextLine(order);
        const subject = `Your order is ready, ${isDelivery ? "delivery" : "pickup"} code ${pickupCode}`;

        const introHtml = isDelivery
          ? paragraph(
              `Your order from <strong>${cook.name}</strong> is on its way!` +
                (arrival
                  ? ` Your cook is arriving <strong>around ${arrival}</strong>. The exact time may shift a little, like any delivery ETA.`
                  : ""),
            ) + paragraph("Show this code to your cook when they arrive:")
          : paragraph(
              `Your order from <strong>${cook.name}</strong> is ready. Show this code when you arrive:`,
            );

        const tipsHtml = isDelivery ? bulletList(deliveryTips) : "";
        const closingHtml = isDelivery
          ? ""
          : paragraph("Show this code any time during your pickup window.");

        const html = htmlEmail({
          title: subject,
          preheader: `Your order from ${cook.name} is ready.`,
          bodyHtml:
            paragraph(greeting(client.firstName)) +
            introHtml +
            pickupCodeBlock(pickupCode, codeLabel) +
            tipsHtml +
            orderDetailsTable([
              { label: "Order", value: order.listingTitle },
              ...(timingRow ? [timingRow] : []),
              ...(pickupRow ? [pickupRow] : []),
            ]) +
            closingHtml +
            contactParagraph(),
        });

        const introText = isDelivery
          ? `Your order from ${cook.name} is on its way!` +
            (arrival
              ? ` Your cook is arriving around ${arrival}. The exact time may shift a little, like any delivery ETA.`
              : "") +
            " Show this code to your cook when they arrive:"
          : `Your order from ${cook.name} is ready. Show this code when you arrive:`;

        const text = textWithContact([
          greeting(client.firstName),
          "",
          introText,
          "",
          pickupCode,
          "",
          ...(isDelivery ? [...deliveryTipsText, ""] : []),
          `Order: ${order.listingTitle}`,
          ...(timingRow ? [`${timingRow.label}: ${timingRow.value}`] : []),
          ...(pickupTextLine ? [pickupTextLine] : []),
          "",
          ...(isDelivery
            ? []
            : ["Show this code any time during your pickup window."]),
        ]);
        await sendMail({ to: client.email, subject, text, html });
      } catch (err) {
        console.error("[email/order-ready-client]", err);
      }
    },
    `7eats: Your order from ${cook.name} is ready. ${codeLabel}: ${pickupCode}`,
  );
}

export async function sendOrderCompletedEmailToClient(
  client: OrderClientRecipient,
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/app/orders/${order.id}`;
  await deliverOrderClientUpdate(
    orderClientRecipient(client),
    async () => {
      try {
        const subject = `Thanks for your order with ${cook.name}`;
        const html = htmlEmail({
          title: "Enjoy your order!",
          preheader: `Your order from ${cook.name} is all yours.`,
          bodyHtml:
            paragraph(greeting(client.firstName)) +
            paragraph(
              `Your order from <strong>${cook.name}</strong> is all yours. We hope every bite is wonderful. Thanks for supporting a home cook in your neighbourhood.`,
            ) +
            orderSummaryHtml(order) +
            paragraph(
              `Enjoyed it? A quick review helps ${cook.name} reach more neighbours.`,
            ) +
            contactParagraph(),
          ctaLabel: "Leave a review",
          ctaUrl: orderUrl,
        });
        const text = textWithContact([
          greeting(client.firstName),
          "",
          `Your order from ${cook.name} is all yours. We hope every bite is wonderful. Thanks for supporting a home cook in your neighbourhood.`,
          "",
          ...orderSummaryText(order),
          "",
          `Enjoyed it? Leave a quick review to help ${cook.name} reach more neighbours:`,
          orderUrl,
        ]);
        await sendMail({ to: client.email, subject, text, html });
      } catch (err) {
        console.error("[email/order-completed-client]", err);
      }
    },
    `7eats: Thanks for your order with ${cook.name}!`,
  );
}

export async function sendOrderCancelledByCookEmailToClient(
  client: OrderClientRecipient,
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
  await deliverOrderClientUpdate(
    orderClientRecipient(client),
    async () => {
      try {
        const timing = formatTiming(order);
        const subject = `Your ${order.listingTitle} order has been cancelled`;
        const html = htmlEmail({
          title: subject,
          preheader: `${cook.name} cancelled your ${order.listingTitle} order.`,
          bodyHtml:
            paragraph(greeting(client.firstName)) +
            paragraph(
              `${cook.name} has cancelled your order for ${order.listingTitle} (${timing}).`,
            ) +
            paragraph(
              "If you were charged, you'll receive a full refund within 3-5 business days.",
            ) +
            contactParagraph(),
        });
        const text = textWithContact([
          greeting(client.firstName),
          "",
          `${cook.name} has cancelled your order for ${order.listingTitle} (${timing}).`,
          "",
          "If you were charged, you'll receive a full refund within 3-5 business days.",
        ]);
        await sendMail({ to: client.email, subject, text, html });
      } catch (err) {
        console.error("[email/order-cancelled-cook]", err);
      }
    },
    `7eats: ${cook.name} cancelled your order for ${order.listingTitle}.`,
  );
}

function refundOutcomeLine(refunded: boolean): string {
  return refunded
    ? "The customer's payment was refunded in full."
    : "No refund was issued per your cancellation policy.";
}

export async function sendOrderCancelledByClientEmailToCook(
  cook: { email: string; firstName: string | null },
  customer: { name: string },
  order: OrderEmailData,
  options: { refunded: boolean },
): Promise<void> {
  try {
    const refundLine = refundOutcomeLine(options.refunded);
    const scheduleClause = cancellationScheduleClause(order);
    const subject = `Order cancelled by ${customer.name}`;
    const html = htmlEmail({
      title: subject,
      preheader: `${customer.name} cancelled their ${order.listingTitle} order.`,
      bodyHtml:
        paragraph(greeting(cook.firstName)) +
        paragraph(
          `${customer.name} cancelled their order for ${order.quantity}× ${order.listingTitle}${scheduleClause}.`,
        ) +
        paragraph(refundLine) +
        contactParagraph(),
      ctaLabel: "View orders",
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/business/orders`,
    });
    const text = textWithContact([
      greeting(cook.firstName),
      "",
      `${customer.name} cancelled their order for ${order.quantity}× ${order.listingTitle}${scheduleClause}.`,
      "",
      refundLine,
      "",
      `${process.env.NEXT_PUBLIC_APP_URL}/business/orders`,
    ]);
    await sendMail({ to: cook.email, subject, text, html });
  } catch (err) {
    console.error("[email/order-cancelled-client-cook]", err);
  }
}

export async function sendOrderCancelledByClientEmailToClient(
  client: OrderClientRecipient,
  cook: { name: string },
  order: OrderEmailData,
  options: {
    refunded: boolean;
    confirmationCode?: string | null;
    isGuestCheckout?: boolean;
    receiptUrl?: string | null;
  },
): Promise<void> {
  await deliverOrderClientUpdate(
    orderClientRecipient(client),
    async () => {
      try {
        const timing = knownTimingLabel(order);
        const refundParagraph = options.refunded
          ? paragraph(
              "Your payment has been released. If a charge already appeared on your card, it should drop off within a few business days.",
            )
          : paragraph(
              "Based on the cook's cancellation policy, no refund was issued for this order.",
            );
        const ordersUrl = `${process.env.NEXT_PUBLIC_APP_URL}/app/orders`;
        const ctaUrl =
          options.receiptUrl ?? (options.isGuestCheckout ? null : ordersUrl);
        const ctaLabel = options.receiptUrl
          ? "View receipt"
          : options.isGuestCheckout
            ? undefined
            : "View your orders";
        const subject = `Your order with ${cook.name} has been cancelled`;
        const html = htmlEmail({
          title: subject,
          preheader: `Your ${order.listingTitle} order was cancelled.`,
          bodyHtml:
            paragraph(greeting(client.firstName)) +
            paragraph(
              `Your order with <strong>${cook.name}</strong> has been cancelled.`,
            ) +
            orderSummaryHtml(order) +
            orderDetailsTable([
              ...(options.confirmationCode
                ? [
                    {
                      label: "Confirmation code",
                      value: options.confirmationCode,
                    },
                  ]
                : []),
              {
                label: "Fulfillment",
                value: fulfillmentLabel(order.fulfillmentMode),
              },
              ...(timing ? [{ label: "Timing", value: timing }] : []),
            ]) +
            refundParagraph +
            contactParagraph(),
          ...(ctaUrl && ctaLabel ? { ctaLabel, ctaUrl } : {}),
        });
        const text = textWithContact([
          greeting(client.firstName),
          "",
          `Your order with ${cook.name} has been cancelled.`,
          "",
          ...(options.confirmationCode
            ? [`Confirmation code: ${options.confirmationCode}`, ""]
            : []),
          ...orderSummaryText(order),
          "",
          `Fulfillment: ${fulfillmentLabel(order.fulfillmentMode)}`,
          ...(timing ? [`Timing: ${timing}`, ""] : []),
          options.refunded
            ? "Your payment has been released. If a charge already appeared on your card, it should drop off within a few business days."
            : "Based on the cook's cancellation policy, no refund was issued for this order.",
          ...(ctaUrl ? ["", `${ctaLabel}:`, ctaUrl] : []),
        ]);
        await sendMail({ to: client.email, subject, text, html });
      } catch (err) {
        console.error("[email/order-cancelled-client-client]", err);
      }
    },
    `7eats: Your order with ${cook.name} has been cancelled.`,
  );
}
