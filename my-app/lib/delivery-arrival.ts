// Arrival-time slots for the cook's "mark ready" step on delivery orders. The
// cook picks an approximate arrival time within the delivery window snapshotted
// on the order (fulfillmentWindowStart/End). Times use the app's runtime-local
// convention, consistent with how the windows themselves are built.

const DEFAULT_STEP_MIN = 30;

type DateInput = Date | string | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Discrete arrival-time options across [windowStart, windowEnd], stepping by
 * `stepMin` minutes and including the end boundary when it lands exactly on a
 * step. Returns [] when the window is missing or inverted.
 */
export function arrivalSlots(
  windowStart: DateInput,
  windowEnd: DateInput,
  stepMin: number = DEFAULT_STEP_MIN,
): Date[] {
  const start = toDate(windowStart);
  const end = toDate(windowEnd);
  if (!start || !end || start.getTime() > end.getTime()) return [];

  const slots: Date[] = [];
  const stepMs = stepMin * 60_000;
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    slots.push(new Date(t));
  }
  return slots;
}

/** Whether `arrival` falls within [windowStart, windowEnd], boundaries included. */
export function isArrivalWithinWindow(
  arrival: DateInput,
  windowStart: DateInput,
  windowEnd: DateInput,
): boolean {
  const a = toDate(arrival);
  const start = toDate(windowStart);
  const end = toDate(windowEnd);
  if (!a || !start || !end) return false;
  return a.getTime() >= start.getTime() && a.getTime() <= end.getTime();
}
