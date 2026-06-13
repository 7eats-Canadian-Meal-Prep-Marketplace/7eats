/**
 * Canadian provincial/territorial tax rates (2024/2025).
 * Rates are combined (GST + PST/QST/HST where applicable).
 */
const TAX_RATES: Record<string, number> = {
  AB: 0.05, // GST only
  BC: 0.12, // GST 5% + PST 7%
  MB: 0.12, // GST 5% + PST 7%
  NB: 0.15, // HST
  NL: 0.15, // HST
  NS: 0.15, // HST
  NT: 0.05, // GST only
  NU: 0.05, // GST only
  ON: 0.13, // HST
  PE: 0.15, // HST
  QC: 0.14975, // GST 5% + QST 9.975%
  SK: 0.11, // GST 5% + PST 6%
  YT: 0.05, // GST only
};

const DEFAULT_TAX_RATE = 0.05; // Safe fallback: GST only

/**
 * Returns the tax label for a given province code.
 * Used to display the tax line in the cart summary.
 */
export function getTaxLabel(province: string): string {
  switch (province) {
    case "ON":
      return "HST (13%)";
    case "NB":
    case "NL":
    case "NS":
    case "PE":
      return `HST (15%)`;
    case "QC":
      return "GST+QST (14.975%)";
    case "BC":
      return "GST+PST (12%)";
    case "MB":
      return "GST+PST (12%)";
    case "SK":
      return "GST+PST (11%)";
    default:
      return "GST (5%)";
  }
}

/**
 * Calculates the tax amount for a given subtotal and province code.
 * Returns the precise unrounded amount; callers should round for display.
 * Falls back to 5% GST for unknown/unrecognized province codes.
 */
export function calcTax(subtotal: number, province: string): number {
  const rate = TAX_RATES[province] ?? DEFAULT_TAX_RATE;
  return subtotal * rate;
}

export function formatCartMoney(amount: number): string {
  return amount.toFixed(2);
}

// ─── Legacy exports (kept for any remaining callers) ──────────────────────────

/** @deprecated Use calcTax(subtotal, "ON") instead */
export const ONTARIO_HST_RATE = 0.13;

/** @deprecated Use getTaxLabel("ON") instead */
export const ONTARIO_HST_LABEL = "HST (13%)";

/** @deprecated Use calcTax(subtotal, "ON") instead */
export function calcOntarioHst(subtotal: number): number {
  return Math.round(calcTax(subtotal, "ON") * 100) / 100;
}
