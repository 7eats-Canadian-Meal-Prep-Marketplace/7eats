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
  cookPayoutCents: number;
};

/**
 * Server-authoritative order pricing for destination charges.
 *
 * - Place of supply: cook pickup province (defaults ON).
 * - Platform fee: percentage of pre-tax subtotal + delivery only.
 * - application_fee_amount: platform fee + tax so HST/GST stays on the platform.
 *
 * Platform discount (record-only v1): reduces the customer's total but NOT the
 * cook payout or the platform-fee base. The platform absorbs the discount out of
 * its own application fee, floored at 0.
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
  // Platform absorbs the discount out of its own fee; never negative.
  const applicationFeeCents = Math.max(
    0,
    platformFeeCents + taxCents - discountCents,
  );
  const cookPayoutCents = totalCents - applicationFeeCents;

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
  };
}
