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
 */
export function computeOrderChargeBreakdown(params: {
  subtotal: number;
  deliveryFee: number;
  taxProvince: string | null | undefined;
  platformFeePct: number;
}): OrderChargeBreakdown {
  const taxProvince = (params.taxProvince ?? "ON")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const taxableBase =
    Math.round((params.subtotal + params.deliveryFee) * 100) / 100;
  const taxAmount = Math.round(calcTax(taxableBase, taxProvince) * 100) / 100;
  const totalPrice = Math.round((taxableBase + taxAmount) * 100) / 100;
  const totalCents = Math.round(totalPrice * 100);
  const taxableBaseCents = Math.round(taxableBase * 100);
  const platformFeeCents = Math.round(
    (taxableBaseCents * params.platformFeePct) / 100,
  );
  const taxCents = Math.round(taxAmount * 100);
  const applicationFeeCents = platformFeeCents + taxCents;
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
