// Guards when a cook may mark an order "ready". A cook can finish food early,
// but releasing the pickup code far in advance is risky (the code has a finite
// life). The rule: a cook may mark ready starting the calendar day before the
// scheduled pickup/delivery, any time that day, through the fulfillment day
// itself. Calendar days are anchored to BUSINESS_TIMEZONE (America/Toronto),
// not the server process's local timezone (see lib/timezone.ts).

import { zonedParts, zonedTimeToUtc } from "@/lib/timezone";

const ONE_DAY_MS = 24 * 3600_000;

export type OrderTiming = {
  pickupAt?: Date | string | null;
  fulfillmentWindowStart?: Date | string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The order's scheduled moment: the exact pickup minute, else the window day. */
function fulfillmentMoment(timing: OrderTiming): Date | null {
  return toDate(timing.pickupAt) ?? toDate(timing.fulfillmentWindowStart);
}

/** Eastern midnight of the given date. */
function startOfDay(date: Date): Date {
  const { year, month, day } = zonedParts(date);
  return zonedTimeToUtc(year, month, day, 0, 0, 0);
}

/**
 * Earliest moment a cook is allowed to mark the order ready: Eastern midnight
 * of the calendar day before the scheduled fulfillment. Null when the order
 * has no schedule to guard against.
 */
export function readyAvailableFrom(timing: OrderTiming): Date | null {
  const moment = fulfillmentMoment(timing);
  if (!moment) return null;
  return new Date(startOfDay(moment).getTime() - ONE_DAY_MS);
}

/**
 * Whether a cook may mark the order ready now. True from the day before the
 * scheduled fulfillment onward (and always true for orders with no schedule,
 * since there is nothing to guard).
 */
export function canMarkReady(
  timing: OrderTiming,
  now: Date = new Date(),
): boolean {
  const from = readyAvailableFrom(timing);
  if (!from) return true;
  return now.getTime() >= from.getTime();
}
