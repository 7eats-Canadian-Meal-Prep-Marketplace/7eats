type TimingInput = {
  pickupAt?: Date | string | null;
  fulfillmentWindowStart?: Date | string | null;
  fulfillmentWindowEnd?: Date | string | null;
};

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatOrderTimingDate(timing: TimingInput): string | null {
  const date =
    toValidDate(timing.pickupAt) ?? toValidDate(timing.fulfillmentWindowStart);
  if (!date) return null;

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatOrderTimingWindow(
  timing: TimingInput,
  fallbackWindowHours = 2,
): string | null {
  const exact = toValidDate(timing.pickupAt);
  const start = exact ?? toValidDate(timing.fulfillmentWindowStart);
  if (!start) return null;

  const end =
    exact != null
      ? new Date(exact.getTime() + fallbackWindowHours * 3600_000)
      : toValidDate(timing.fulfillmentWindowEnd);
  if (!end) return null;

  const format = (date: Date) =>
    date
      .toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
      .toLowerCase()
      .replace(":00", "");

  return `${format(start)} – ${format(end)}`;
}
