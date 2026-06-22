/**
 * Canadian provincial/territorial tax rates (2024/2025).
 * Place of supply for meal orders is the cook's province (server-side).
 * Rates are combined (GST + PST/QST/HST where applicable).
 */
const TAX_RATES: Record<string, number> = {
  AB: 0.05,
  BC: 0.12,
  MB: 0.12,
  NB: 0.15,
  NL: 0.15,
  NS: 0.15,
  NT: 0.05,
  NU: 0.05,
  ON: 0.13,
  PE: 0.15,
  QC: 0.14975,
  SK: 0.11,
  YT: 0.05,
};

const DEFAULT_TAX_RATE = 0.05;

/**
 * Sales-tax collection master switch.
 *
 * 7eats is not yet registered for GST/HST, so we must not collect tax we have no
 * number to remit. Collection is therefore OFF unless
 * `NEXT_PUBLIC_TAX_COLLECTION_ENABLED=true` is set. Flip it once registered.
 *
 * It is `NEXT_PUBLIC_` on purpose: the client cart/checkout estimate and the
 * server-authoritative charge both flow through {@link calcTax}, so a single
 * env value keeps them in lockstep. Read at call time so tests can toggle it.
 */
export function isTaxCollectionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED === "true";
}

function normalizeProvince(province: string): string {
  return province.trim().toUpperCase().slice(0, 2);
}

/** Returns the display label for a province's tax line. */
export function getTaxLabel(province: string): string {
  switch (normalizeProvince(province)) {
    case "ON":
      return "HST (13%)";
    case "NB":
    case "NL":
    case "NS":
    case "PE":
      return "HST (15%)";
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
 * Tax on a taxable base (food subtotal + delivery fee).
 * Returns the precise unrounded amount; callers round to cents for money.
 */
export function calcTax(taxableBase: number, province: string): number {
  if (!isTaxCollectionEnabled()) return 0;
  const code = normalizeProvince(province);
  const rate = TAX_RATES[code] ?? DEFAULT_TAX_RATE;
  return taxableBase * rate;
}
