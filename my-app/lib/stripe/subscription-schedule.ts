export type SubscriptionInterval = "weekly" | "biweekly" | "monthly";

export const SUBSCRIPTION_INTERVALS: SubscriptionInterval[] = [
  "weekly",
  "biweekly",
  "monthly",
];

export const INTERVAL_LABELS: Record<SubscriptionInterval, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

export const INTERVAL_SHORT_LABELS: Record<SubscriptionInterval, string> = {
  weekly: "wk",
  biweekly: "2 wks",
  monthly: "mo",
};

/** "Charged automatically ___ until you unsubscribe." */
export const INTERVAL_RECURRENCE_PHRASES: Record<SubscriptionInterval, string> =
  {
    weekly: "every week",
    biweekly: "every 2 weeks",
    monthly: "every month",
  };

// Order matches Date#getUTCDay()/getDay(): 0 = Sunday ... 6 = Saturday.
export const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type DayOfWeek = (typeof DAY_NAMES)[number];

/**
 * Finds the next date on or after `from` that falls on one of `pickupDays`.
 * Returns null if `pickupDays` is empty.
 */
export function getNextPickupDate(
  from: Date,
  pickupDays: DayOfWeek[],
): Date | null {
  if (pickupDays.length === 0) return null;

  const allowed = new Set(pickupDays.map((d) => DAY_NAMES.indexOf(d)));
  const fromDay = from.getUTCDay();

  for (let offset = 0; offset < 7; offset++) {
    if (allowed.has((fromDay + offset) % 7)) {
      const result = new Date(from);
      result.setUTCDate(from.getUTCDate() + offset);
      return result;
    }
  }

  return null;
}

/**
 * Derives the next fulfillment (pickup/delivery) date for a subscription.
 *
 * The reference point is the later of `currentPeriodEnd` (the subscription's
 * next billing date) and `now` — a subscription can't be fulfilled before it
 * renews, but if billing has already lapsed we fall back to the next
 * available pickup day from today.
 */
export function getNextFulfillmentDate(
  currentPeriodEnd: Date | null,
  pickupDays: DayOfWeek[],
  now: Date = new Date(),
): Date | null {
  const reference =
    currentPeriodEnd && currentPeriodEnd > now ? currentPeriodEnd : now;
  return getNextPickupDate(reference, pickupDays);
}
