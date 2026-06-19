import { sendMail } from "@/lib/email";
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
};

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
    const pickup = formatPickup(order.pickupAt);
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
          { label: "Pickup", value: pickup },
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
      `Pickup: ${pickup}`,
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
    const pickup = formatPickup(order.pickupAt);
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
          { label: "Pickup", value: pickup },
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
      `Pickup: ${pickup}`,
      "",
      "Track it any time from your orders:",
      `${process.env.NEXT_PUBLIC_APP_URL}/app/orders/${order.id}`,
    ]);
    await sendMail({ to: client.email, subject, text, html });
  } catch (err) {
    console.error("[email/order-receipt-client]", err);
  }
}

export async function sendOrderConfirmedEmailToClient(
  client: { email: string; firstName: string | null },
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
  try {
    const pickup = formatPickup(order.pickupAt);
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
          { label: "Pickup", value: pickup },
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
      `Pickup: ${pickup}`,
      "",
      "You'll get another email with your pickup code once the order is ready.",
    ]);
    await sendMail({ to: client.email, subject, text, html });
  } catch (err) {
    console.error("[email/order-confirmed-client]", err);
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

export async function sendOrderCancelledByCookEmailToClient(
  client: { email: string; firstName: string | null },
  cook: { name: string },
  order: OrderEmailData,
): Promise<void> {
  try {
    const pickup = formatPickup(order.pickupAt);
    const subject = `Your ${order.listingTitle} order has been cancelled`;
    const html = htmlEmail({
      title: subject,
      preheader: `${cook.name} cancelled your ${order.listingTitle} order.`,
      bodyHtml:
        paragraph(greeting(client.firstName)) +
        paragraph(
          `${cook.name} has cancelled your order for ${order.listingTitle} on ${pickup}.`,
        ) +
        paragraph(
          "If you were charged, you'll receive a full refund within 3–5 business days.",
        ) +
        contactParagraph(),
    });
    const text = textWithContact([
      greeting(client.firstName),
      "",
      `${cook.name} has cancelled your order for ${order.listingTitle} on ${pickup}.`,
      "",
      "If you were charged, you'll receive a full refund within 3–5 business days.",
    ]);
    await sendMail({ to: client.email, subject, text, html });
  } catch (err) {
    console.error("[email/order-cancelled-cook]", err);
  }
}

export async function sendOrderCancelledByClientEmailToCook(
  cook: { email: string; firstName: string | null },
  customer: { name: string },
  order: OrderEmailData,
): Promise<void> {
  try {
    const pickup = formatPickup(order.pickupAt);
    const subject = `Order cancelled by ${customer.name}`;
    const html = htmlEmail({
      title: subject,
      preheader: `${customer.name} cancelled their ${order.listingTitle} order.`,
      bodyHtml:
        paragraph(greeting(cook.firstName)) +
        paragraph(
          `${customer.name} cancelled their order for ${order.quantity}× ${order.listingTitle} scheduled for ${pickup}.`,
        ) +
        contactParagraph(),
    });
    const text = textWithContact([
      greeting(cook.firstName),
      "",
      `${customer.name} cancelled their order for ${order.quantity}× ${order.listingTitle} scheduled for ${pickup}.`,
    ]);
    await sendMail({ to: cook.email, subject, text, html });
  } catch (err) {
    console.error("[email/order-cancelled-client]", err);
  }
}
