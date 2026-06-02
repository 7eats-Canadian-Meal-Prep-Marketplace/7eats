import type { MockListing } from "./_mock";

export type FulfillmentMode = "pickup" | "delivery";

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

export function orderTypeLabel(orderType: MockListing["orderType"]): string {
  switch (orderType) {
    case "subscription":
      return "Subscription";
    case "both":
      return "Single order or subscription";
    default:
      return "Single order";
  }
}

export function scheduleLine(
  listing: MockListing,
  fulfillment: FulfillmentMode,
): {
  orderBy: string;
  receiveOn: string;
  urgency: "urgent" | "soon" | "normal";
} {
  const h = hoursUntil(listing.orderDeadlineIso);
  let orderBy: string;
  let urgency: "urgent" | "soon" | "normal";

  if (h <= 0) {
    orderBy = "Orders closed";
    urgency = "urgent";
  } else if (h < 2) {
    orderBy = `Closes in ${Math.ceil(h)}h`;
    urgency = "urgent";
  } else if (h < 24) {
    orderBy = `Closes in ${Math.ceil(h)}h`;
    urgency = "soon";
  } else {
    orderBy = `Order by ${listing.orderDeadlineShort}`;
    urgency = "normal";
  }

  const receiveOn =
    fulfillment === "delivery"
      ? `Delivers ${listing.pickupDate}`
      : `Pickup ${listing.pickupDate}`;

  return { orderBy, receiveOn, urgency };
}
