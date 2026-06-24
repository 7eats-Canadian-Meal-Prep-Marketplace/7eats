import { calcTax, getTaxLabel } from "@/lib/tax";

/** @deprecated Import from `@/lib/tax` instead. Re-exported for existing callers. */
export { calcTax, getTaxLabel };

export function formatCartMoney(amount: number): string {
  return amount.toFixed(2);
}

/** @deprecated Use calcTax(subtotal, "ON") instead */
export const ONTARIO_HST_RATE = 0.13;

/** @deprecated Use getTaxLabel("ON") instead */
export const ONTARIO_HST_LABEL = "HST (13%)";

/** @deprecated Use calcTax(subtotal, "ON") instead */
export function calcOntarioHst(subtotal: number): number {
  return Math.round(calcTax(subtotal, "ON") * 100) / 100;
}
