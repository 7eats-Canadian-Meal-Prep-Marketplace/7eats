import { calcTax } from "@/lib/tax";

export type OrderChargeBreakdown = {
  /** Pre-tax subtotal + delivery fee. */
  taxableBase: number;
  taxProvince: string;
  taxAmount: number;
  /** Client-facing total charged on the PaymentIntent. */
  totalPrice: number;
  totalCents: number;
  /** Platform commission on taxableBase (excludes tax). */
  platformFeeCents: number;
  taxCents: number;
  /** Stripe application_fee_amount: commission + tax (tax is not transferred to cook). */
  applicationFeeCents: number;
  /**
   * The cook's FULL payout — pre-discount base minus the platform commission.
   * Always paid in full regardless of any platform discount.
   */
  cookPayoutCents: number;
  /**
   * Extra amount the platform must transfer to the cook FROM ITS OWN BALANCE so
   * the cook is paid in full when the discount exceeds the platform fee. The
   * destination charge only covers the cook up to what the customer paid; this
   * top-up is the shortfall = max(0, discount − fee − tax). 0 when the fee alone
   * covers the discount. Settled at capture via a separate Stripe transfer.
   */
  subsidyTopUpCents: number;
};

/**
 * Server-authoritative order pricing for destination charges.
 *
 * - Place of supply: cook pickup province (defaults ON).
 * - Platform fee: percentage of pre-tax subtotal + delivery only.
 * - application_fee_amount: platform fee + tax so HST/GST stays on the platform.
 *
 * Platform discount (full subsidy): reduces the customer's total but NEVER the
 * cook payout. The platform funds the discount first out of its own application
 * fee (floored at 0); any remainder when the discount exceeds the fee is paid to
 * the cook as a separate platform-funded top-up transfer (`subsidyTopUpCents`),
 * so the cook is always made whole and the platform's net on the order goes
 * negative.
 */
export function computeOrderChargeBreakdown(params: {
  subtotal: number;
  deliveryFee: number;
  taxProvince: string | null | undefined;
  platformFeePct: number;
  platformDiscount?: number;
}): OrderChargeBreakdown {
  const platformDiscount = Math.max(0, params.platformDiscount ?? 0);
  const taxProvince = (params.taxProvince ?? "ON")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  // Pre-discount base drives platform fee + cook payout (record-only v1).
  const preDiscountBase =
    Math.round((params.subtotal + params.deliveryFee) * 100) / 100;
  // Customer pays the discounted base. Tax is 0 while collection is disabled.
  const taxableBase =
    Math.round((preDiscountBase - platformDiscount) * 100) / 100;
  const taxAmount = Math.round(calcTax(taxableBase, taxProvince) * 100) / 100;
  const totalPrice = Math.round((taxableBase + taxAmount) * 100) / 100;
  const totalCents = Math.round(totalPrice * 100);
  const preDiscountBaseCents = Math.round(preDiscountBase * 100);
  const platformFeeCents = Math.round(
    (preDiscountBaseCents * params.platformFeePct) / 100,
  );
  const taxCents = Math.round(taxAmount * 100);
  const discountCents = Math.round(platformDiscount * 100);
  // The platform funds the discount first out of its own fee (floored at 0).
  const applicationFeeCents = Math.max(
    0,
    platformFeeCents + taxCents - discountCents,
  );
  // Cook is always paid in full: pre-discount base minus the platform commission.
  // (Identical to `totalCents - applicationFeeCents` whenever the discount is
  // fully absorbed by the fee; for larger discounts the gap is the top-up below.)
  const cookPayoutCents = preDiscountBaseCents - platformFeeCents;
  // When the discount exceeds the fee (+tax), the destination charge can't cover
  // the cook fully — the platform tops up the remainder from its own balance.
  const subsidyTopUpCents = Math.max(
    0,
    discountCents - platformFeeCents - taxCents,
  );

  return {
    taxableBase,
    taxProvince,
    taxAmount,
    totalPrice,
    totalCents,
    platformFeeCents,
    taxCents,
    applicationFeeCents,
    cookPayoutCents,
    subsidyTopUpCents,
  };
}
