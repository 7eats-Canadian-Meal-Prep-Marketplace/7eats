import { sendMail } from "@/lib/email";
import { formatOrderTimingLabel } from "@/lib/order-timing-label";
import {
  contactParagraph,
  contactTextLine,
  htmlEmail,
  orderDetailsTable,
  paragraph,
  pickupCodeBlock,
} from "./base";

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
};

function fulfillmentLabel(mode: OrderEmailData["fulfillmentMode"]): string {
  return mode === "delivery" ? "Delivery" : "Pickup";
}

function formatPickup(pickupAt: Date | string | null): string {
  if (!pickupAt) return "TBD";

  const date = new Date(pickupAt);
  if (Number.isNaN(date.getTime())) return "TBD";

  const day = date.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} at ${time}`;
}

/** Confirmation emails only — status/cancel emails keep using formatPickup. */
function formatTiming(order: OrderEmailData): string {
  return formatOrderTimingLabel(order);
}

/** Omit TBD — cancelled orders don't need a vague timing line. */
function knownTimingLabel(order: OrderEmailData): string | null {
  const timing = formatTiming(order);
  return timing === "TBD" ? null : timing;
}

function cancellationScheduleClause(order: OrderEmailData): string {
  const timing = knownTimingLabel(order);
  return timing ? ` scheduled for ${timing}` : "";
}

function formatMoney(total: string, currency: string): string {
  return `$${total} ${currency}`;
}

function greeting(firstName: string | null): string {
  return firstName ? `Hi ${firstName},` : "Hi,";
}

function textWithContact(lines: string[]): string {
  return [...lines, "", contactTextLine()].join("\n");
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
  client: { email: string; firstName: string | null },
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
  try {
    const timing = formatTiming(order);
    const subject = `Your 7eats order with ${cook.name} is confirmed`;
    const html = htmlEmail({
      title: subject,
      preheader: `We received your order from ${cook.name}.`,
      bodyHtml:
        paragraph(greeting(client.firstName)) +
        paragraph(`Thanks for your order with <strong>${cook.name}</strong>.`) +
        orderDetailsTable([
          { label: "Items", value: order.listingTitle },
          {
            label: "Total",
            value: formatMoney(order.totalPrice, order.currency),
          },
          {
            label: "Fulfillment",
            value: fulfillmentLabel(order.fulfillmentMode),
          },
          { label: "Timing", value: timing },
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
      `Items: ${order.listingTitle}`,
      `Total: ${formatMoney(order.totalPrice, order.currency)}`,
      `Fulfillment: ${fulfillmentLabel(order.fulfillmentMode)}`,
      `Timing: ${timing}`,
      "",
      "Track it any time from your orders:",
      `${process.env.NEXT_PUBLIC_APP_URL}/app/orders/${order.id}`,
    ]);
    await sendMail({ to: client.email, subject, text, html });
  } catch (err) {
    console.error("[email/order-receipt-client]", err);
  }
}

export async function sendGuestOrderReceiptToClient(
  client: { email: string; firstName: string | null },
  cook: { name: string },
  order: OrderEmailData & { cancellationAllowed?: boolean },
  guest: { confirmationCode: string; accessToken: string },
): Promise<void> {
  try {
    const timing = formatTiming(order);
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
        orderDetailsTable([
          { label: "Confirmation code", value: guest.confirmationCode },
          { label: "Items", value: order.listingTitle },
          {
            label: "Total",
            value: formatMoney(order.totalPrice, order.currency),
          },
          {
            label: "Fulfillment",
            value: fulfillmentLabel(order.fulfillmentMode),
          },
          { label: "Timing", value: timing },
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
      `Confirmation code: ${guest.confirmationCode}`,
      `Items: ${order.listingTitle}`,
      `Total: ${formatMoney(order.totalPrice, order.currency)}`,
      `Fulfillment: ${fulfillmentLabel(order.fulfillmentMode)}`,
      `Timing: ${timing}`,
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
  client: { email: string; firstName: string | null },
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
  try {
    const timing = formatTiming(order);
    const subject = "Your order is confirmed";
    const html = htmlEmail({
      title: subject,
      preheader: `${cook.name} confirmed your order.`,
      bodyHtml:
        paragraph(greeting(client.firstName)) +
        paragraph(`${cook.name} confirmed your order. See you at pickup.`) +
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
          "You'll get another email with your pickup code once the order is ready.",
        ) +
        contactParagraph(),
    });
    const text = textWithContact([
      greeting(client.firstName),
      "",
      `${cook.name} confirmed your order. See you at pickup.`,
      "",
      `Order: ${order.listingTitle}`,
      `Quantity: ${order.quantity}`,
      `Total: ${formatMoney(order.totalPrice, order.currency)}`,
      `${fulfillmentLabel(order.fulfillmentMode)}: ${timing}`,
      "",
      "You'll get another email with your pickup code once the order is ready.",
    ]);
    await sendMail({ to: client.email, subject, text, html });
  } catch (err) {
    console.error("[email/order-confirmed-client]", err);
  }
}

export async function sendOrderNotReadyEmailToClient(
  client: { email: string; firstName: string | null },
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
  try {
    const timing = formatTiming(order);
    const subject = `Your order from ${cook.name} is taking a little longer`;
    const html = htmlEmail({
      title: subject,
      preheader: `${cook.name} needs a bit more time on your order.`,
      bodyHtml:
        paragraph(greeting(client.firstName)) +
        paragraph(
          `Quick heads-up — your order from <strong>${cook.name}</strong> is taking a little longer than expected. They're still hard at work on it and will have it ready as soon as they can.`,
        ) +
        orderDetailsTable([
          { label: "Order", value: order.listingTitle },
          { label: fulfillmentLabel(order.fulfillmentMode), value: timing },
        ]) +
        paragraph(
          "No need to do anything — we'll email you a fresh pickup code the moment it's ready. Thanks for your patience!",
        ) +
        contactParagraph(),
    });
    const text = textWithContact([
      greeting(client.firstName),
      "",
      `Quick heads-up — your order from ${cook.name} is taking a little longer than expected. They're still hard at work on it and will have it ready as soon as they can.`,
      "",
      `Order: ${order.listingTitle}`,
      `${fulfillmentLabel(order.fulfillmentMode)}: ${timing}`,
      "",
      "No need to do anything — we'll email you a fresh pickup code the moment it's ready. Thanks for your patience!",
    ]);
    await sendMail({ to: client.email, subject, text, html });
  } catch (err) {
    console.error("[email/order-not-ready-client]", err);
  }
}

export async function sendOrderReadyEmailToClient(
  client: { email: string; firstName: string | null },
  cook: { name: string },
  order: OrderEmailData,
  pickupCode: string,
): Promise<void> {
  try {
    const pickup = formatPickup(order.pickupAt);
    const subject = `Your order is ready, pickup code ${pickupCode}`;
    const html = htmlEmail({
      title: subject,
      preheader: `Your order from ${cook.name} is ready for pickup.`,
      bodyHtml:
        paragraph(greeting(client.firstName)) +
        paragraph(
          `Your order from ${cook.name} is ready. Show this code when you arrive:`,
        ) +
        pickupCodeBlock(pickupCode) +
        orderDetailsTable([
          { label: "Order", value: order.listingTitle },
          { label: "Pickup", value: pickup },
        ]) +
        paragraph("This code expires 24 hours after it was issued.") +
        contactParagraph(),
    });
    const text = textWithContact([
      greeting(client.firstName),
      "",
      `Your order from ${cook.name} is ready. Show this code when you arrive:`,
      "",
      pickupCode,
      "",
      `Order: ${order.listingTitle}`,
      `Pickup: ${pickup}`,
      "",
      "This code expires 24 hours after it was issued.",
    ]);
    await sendMail({ to: client.email, subject, text, html });
  } catch (err) {
    console.error("[email/order-ready-client]", err);
  }
}

export async function sendOrderCompletedEmailToClient(
  client: { email: string; firstName: string | null },
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
  try {
    const subject = `Thanks for your order with ${cook.name}`;
    const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/app/orders/${order.id}`;
    const html = htmlEmail({
      title: "Enjoy your order!",
      preheader: `Your order from ${cook.name} is all yours.`,
      bodyHtml:
        paragraph(greeting(client.firstName)) +
        paragraph(
          `Your order from <strong>${cook.name}</strong> is all yours — we hope every bite is wonderful. Thanks for supporting a home cook in your neighbourhood.`,
        ) +
        orderDetailsTable([
          { label: "Order", value: order.listingTitle },
          {
            label: "Total",
            value: formatMoney(order.totalPrice, order.currency),
          },
        ]) +
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
      `Your order from ${cook.name} is all yours — we hope every bite is wonderful. Thanks for supporting a home cook in your neighbourhood.`,
      "",
      `Order: ${order.listingTitle}`,
      `Total: ${formatMoney(order.totalPrice, order.currency)}`,
      "",
      `Enjoyed it? Leave a quick review to help ${cook.name} reach more neighbours:`,
      orderUrl,
    ]);
    await sendMail({ to: client.email, subject, text, html });
  } catch (err) {
    console.error("[email/order-completed-client]", err);
  }
}

export async function sendOrderCancelledByCookEmailToClient(
  client: { email: string; firstName: string | null },
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
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
  client: { email: string; firstName: string | null },
  cook: { name: string },
  order: OrderEmailData,
  options: {
    refunded: boolean;
    confirmationCode?: string | null;
    isGuestCheckout?: boolean;
    receiptUrl?: string | null;
  },
): Promise<void> {
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
        orderDetailsTable([
          ...(options.confirmationCode
            ? [{ label: "Confirmation code", value: options.confirmationCode }]
            : []),
          { label: "Items", value: order.listingTitle },
          {
            label: "Total",
            value: formatMoney(order.totalPrice, order.currency),
          },
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
      `Items: ${order.listingTitle}`,
      `Total: ${formatMoney(order.totalPrice, order.currency)}`,
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
}
