/** Shared timing copy for confirmation email + guest receipt. */

type TimingOrder = {
  pickupAt: Date | string | null;
  fulfillmentWindowStart?: Date | string | null;
  fulfillmentWindowEnd?: Date | string | null;
  fulfillmentMode?: "pickup" | "delivery" | null;
};

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCompactTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${hour}${period}`
    : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function formatFulfillmentWindow(order: TimingOrder): string | null {
  const startDate = parseDate(order.fulfillmentWindowStart ?? null);
  const endDate = parseDate(order.fulfillmentWindowEnd ?? null);
  if (!startDate || !endDate) return null;

  const dayPart = startDate.toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const range = `${formatCompactTime(startDate)}-${formatCompactTime(endDate)}`;
  return `${dayPart} · ${range}`;
}

export type ClientOrderTiming = {
  schedule: string;
  hint: string | null;
};

/** Order detail + list — date/window when known; exact minute comes later. */
export function formatClientOrderTiming(order: TimingOrder): ClientOrderTiming {
  const pickupDate = parseDate(order.pickupAt);
  if (pickupDate) {
    const day = pickupDate.toLocaleDateString("en-CA", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const time = pickupDate.toLocaleTimeString("en-CA", {
      hour: "numeric",
      minute: "2-digit",
    });
    return { schedule: `${day} · ${time}`, hint: null };
  }

  const windowSchedule = formatFulfillmentWindow(order);
  if (windowSchedule) {
    return {
      schedule: windowSchedule,
      hint:
        order.fulfillmentMode === "delivery"
          ? "Exact time will be notified when your order is confirmed."
          : "Pick up any time during this window.",
    };
  }

  return {
    schedule: "Date to be confirmed",
    hint: "We'll confirm your pickup or delivery window after payment.",
  };
}

export function formatOrderTimingLabel(order: TimingOrder): string {
  const pickupDate = parseDate(order.pickupAt);
  if (pickupDate) {
    const day = pickupDate.toLocaleDateString("en-CA", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const time = pickupDate.toLocaleTimeString("en-CA", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${day} at ${time}`;
  }

  const windowSchedule = formatFulfillmentWindow(order);
  if (windowSchedule) {
    const suffix =
      order.fulfillmentMode === "delivery"
        ? " (exact time confirmed later)"
        : " (any time in this window)";
    return `${windowSchedule}${suffix}`;
  }

  return "Date to be confirmed";
}
