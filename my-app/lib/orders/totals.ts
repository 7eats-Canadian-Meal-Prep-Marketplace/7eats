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
   * Amount the platform transfers to the cook FROM ITS OWN BALANCE to cover the
   * discount, normally the full discount amount (not reduced by the platform
   * fee). Sent as a second, separate Stripe transfer alongside the destination
   * charge's payout so the split reads cleanly: client pays the discounted
   * total, 7eats pays the discount, then the platform fee comes out of that
   * combined pool. Only reduced below the discount in the pathological case
   * where the fee+tax can't be fully collected from a heavily-discounted charge
   * (see below). Settled at release via a separate Stripe transfer.
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
 * cook payout. Two clean transfers make the cook whole: the destination charge
 * pays out the discounted total minus the platform's normal commission, and a
 * separate transfer pays the cook the full discount amount, funded from the
 * platform's own balance. The platform fee is taken from the destination charge
 * whenever the discounted total can cover it; if a discount is so large that
 * the fee can't be taken from the charge, the shortfall is added to the subsidy
 * transfer instead so the cook is always paid pre-discount-base minus the fee.
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
  // The platform fee always comes out of the destination charge in full, capped
  // so application_fee_amount never exceeds the charge (Stripe requirement).
  const feeAndTaxCents = platformFeeCents + taxCents;
  const applicationFeeCents = Math.min(feeAndTaxCents, totalCents);
  // Cook is always paid in full: pre-discount base minus the platform commission.
  const cookPayoutCents = preDiscountBaseCents - platformFeeCents;
  // The subsidy transfer is the full discount amount, funded from the platform's
  // own balance. When the discount is so large the fee+tax can't be fully taken
  // from the (small, heavily-discounted) charge above, the uncollected fee is
  // deducted here instead so the cook still lands on exactly cookPayoutCents.
  const subsidyTopUpCents = Math.max(
    0,
    discountCents - Math.max(0, feeAndTaxCents - totalCents),
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
