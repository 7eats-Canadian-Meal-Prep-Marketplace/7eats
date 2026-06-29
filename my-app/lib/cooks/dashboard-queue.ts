// Schedule resolution for the cook dashboard queue. A freshly placed order has
// no exact `pickupAt` yet — that minute is only pinned later (delivery) and
// never for pickup — so the queue must fall back to the fulfillment window, the
// day captured for every order at placement. Mirrors the orders list/detail.

export type QueueScheduleOrder = {
  pickupAt: string | null;
  fulfillmentWindowStart: string | null;
};

function valid(isoString: string | null): string | null {
  if (!isoString) return null;
  return Number.isNaN(new Date(isoString).getTime()) ? null : isoString;
}

/** The order's scheduled moment: the pinned pickup minute, else the window day. */
export function queueScheduleIso(order: QueueScheduleOrder): string | null {
  return valid(order.pickupAt) ?? valid(order.fulfillmentWindowStart);
}

/**
 * The next scheduled fulfillment day and its confirmed/ready orders, sorted by
 * time. Pending requests live in their own column, and orders with no schedule
 * at all are skipped (nothing to place on a day).
 */
export function nextPickupDayOrders<
  T extends QueueScheduleOrder & { status: string },
>(orders: T[]): { label: string; orders: T[] } {
  const scheduled = orders
    .filter((o) => o.status !== "pending")
    .map((o) => ({ order: o, iso: queueScheduleIso(o) }))
    .filter((x): x is { order: T; iso: string } => x.iso !== null);

  if (scheduled.length === 0) return { label: "Today's pickups", orders: [] };

  const dayStart = (isoString: string) => {
    const d = new Date(isoString);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const earliest = Math.min(...scheduled.map((x) => dayStart(x.iso)));
  const dayOrders = scheduled
    .filter((x) => dayStart(x.iso) === earliest)
    .sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime())
    .map((x) => x.order);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  let label: string;
  if (earliest === today.getTime()) label = "Today's pickups";
  else if (earliest === tomorrow.getTime()) label = "Tomorrow's pickups";
  else {
    const d = new Date(earliest);
    label = `${d.toLocaleDateString("en-CA", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })} pickups`;
  }

  return { label, orders: dayOrders };
}
