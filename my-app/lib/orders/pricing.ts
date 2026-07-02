import type { leadTimeEnum } from "@/db/schema";
import {
  LEAD_TIME_DAYS,
  LEAD_TIME_HOURS,
  type LeadTimeRules,
  cancelByDate as leadCancelByDate,
  earliestPickup as leadEarliestPickup,
  isRefundEligible as leadIsRefundEligible,
  refundCutoffExclusive as leadRefundCutoffExclusive,
} from "@/lib/lead-time";

export type PromoLike = { type: "percentage_off" | "fixed_off"; value: number };

/**
 * Compute the discount and line total for one order line. The promo applies
 * per unit and is then multiplied by the quantity: a $5 fixed_off on 4 items
 * discounts $5 from each item ($20 total), not $5 off the whole line. The
 * per-unit discount is clamped to the unit price so a line never goes negative.
 * Values are rounded to cents.
 */
export function computeLineTotal(
  price: number,
  quantity: number,
  promo: PromoLike | null,
): { discountAmount: number; lineTotal: number } {
  const gross = price * quantity;
  let discount = 0;
  if (promo) {
    const perUnitDiscount =
      promo.type === "percentage_off"
        ? (price * promo.value) / 100
        : promo.value;
    discount = Math.min(perUnitDiscount, price) * quantity;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    discountAmount: round(discount),
    lineTotal: round(gross - discount),
  };
}

type LeadTime = (typeof leadTimeEnum.enumValues)[number];

export { LEAD_TIME_HOURS, LEAD_TIME_DAYS };

function toRules(
  leadTime: LeadTime | string | null,
  leadTimeCutoff?: string | null,
): LeadTimeRules {
  return { leadTime, leadTimeCutoff };
}

export function earliestPickup(
  leadTime: LeadTime | null,
  now: Date = new Date(),
  leadTimeCutoff?: string | null,
): Date {
  return leadEarliestPickup(toRules(leadTime, leadTimeCutoff), now);
}

export function refundCutoffExclusive(
  pickupAt: Date,
  leadTime: LeadTime | null,
  leadTimeCutoff?: string | null,
): Date | null {
  return leadRefundCutoffExclusive(pickupAt, toRules(leadTime, leadTimeCutoff));
}

export function isRefundEligible(
  pickupAt: Date | null,
  leadTime: LeadTime | null,
  cancellationAllowed: boolean,
  now: Date = new Date(),
  leadTimeCutoff?: string | null,
): boolean {
  return leadIsRefundEligible(
    pickupAt,
    toRules(leadTime, leadTimeCutoff),
    cancellationAllowed,
    now,
  );
}

export { leadCancelByDate as cancelByDateForRules };
