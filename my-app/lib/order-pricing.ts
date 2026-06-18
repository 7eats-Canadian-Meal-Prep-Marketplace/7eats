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

/** Earliest valid pickup Date given a lead time and a reference "now". */
export function earliestPickup(
  leadTime: LeadTime | null,
  now: Date = new Date(),
): Date {
  const hours = leadTime ? LEAD_TIME_HOURS[leadTime] : 0;
  return new Date(now.getTime() + hours * 3600_000);
}
