import type { leadTimeEnum } from "@/db/schema";

export type PromoLike = { type: "percentage_off" | "fixed_off"; value: number };

/**
 * Compute the discount and line total for one order line. The discount is
 * clamped so a line never goes negative. Values are rounded to cents.
 */
export function computeLineTotal(
  price: number,
  quantity: number,
  promo: PromoLike | null,
): { discountAmount: number; lineTotal: number } {
  const gross = price * quantity;
  let discount = 0;
  if (promo) {
    discount =
      promo.type === "percentage_off"
        ? (gross * promo.value) / 100
        : promo.value;
    discount = Math.min(discount, gross);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    discountAmount: round(discount),
    lineTotal: round(gross - discount),
  };
}

type LeadTime = (typeof leadTimeEnum.enumValues)[number];

/** Minimum hours between "now" and an allowed pickup time, per cook lead time. */
export const LEAD_TIME_HOURS: Record<LeadTime, number> = {
  same_day: 0,
  "1_day": 24,
  "2_days": 48,
  "3_days": 72,
  "4_days": 96,
  "5_days": 120,
};

/** Whole days of notice a cook requires before a pickup, per lead time. */
export const LEAD_TIME_DAYS: Record<LeadTime, number> = {
  same_day: 0,
  "1_day": 1,
  "2_days": 2,
  "3_days": 3,
  "4_days": 4,
  "5_days": 5,
};

/**
 * Earliest valid pickup Date given a lead time and a reference "now".
 *
 * Lead time is counted in whole calendar days, not rolling hours: a cook with a
 * 3-day lead who is ordered from on Monday can be picked up from on Thursday
 * (Monday + 3 days), regardless of the hour the order is placed. The floor is
 * the start of that calendar day, but never earlier than "now" (so a same-day
 * cook still can't be booked for a time already past).
 */
export function earliestPickup(
  leadTime: LeadTime | null,
  now: Date = new Date(),
): Date {
  const days = leadTime ? LEAD_TIME_DAYS[leadTime] : 0;
  const dayFloor = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + days,
  );
  return dayFloor.getTime() < now.getTime() ? now : dayFloor;
}

/**
 * Exclusive upper bound for refund eligibility: start of the calendar day after
 * the last day a client may cancel. Pickup Thursday with a 3-day lead → eligible
 * through end of Monday (now < Tuesday 00:00 local).
 */
export function refundCutoffExclusive(
  pickupAt: Date,
  leadTime: LeadTime | null,
): Date | null {
  if (Number.isNaN(pickupAt.getTime())) return null;
  const days = leadTime ? LEAD_TIME_DAYS[leadTime] : 0;
  const pickupDay = new Date(
    pickupAt.getFullYear(),
    pickupAt.getMonth(),
    pickupAt.getDate(),
  );
  return new Date(
    pickupDay.getFullYear(),
    pickupDay.getMonth(),
    pickupDay.getDate() - days + 1,
  );
}

export function isRefundEligible(
  pickupAt: Date | null,
  leadTime: LeadTime | null,
  cancellationAllowed: boolean,
  now: Date = new Date(),
): boolean {
  if (!cancellationAllowed || !pickupAt) return false;
  const cutoff = refundCutoffExclusive(pickupAt, leadTime);
  return cutoff != null && now < cutoff;
}
