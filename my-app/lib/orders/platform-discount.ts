export type PlatformDiscountRow = {
  id: string;
  discountType: "percentage" | "fixed";
  value: number;
  maxDiscountAmount: number | null;
  minOrderSubtotal: number | null;
  perUserLimit: number;
  createdAt: Date;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Dollar value of a discount for a given subtotal. 0 if it does not qualify. */
export function computeDiscountValue(
  d: PlatformDiscountRow,
  subtotal: number,
): number {
  if (d.minOrderSubtotal != null && subtotal < d.minOrderSubtotal) return 0;
  if (subtotal <= 0) return 0;
  if (d.discountType === "fixed") return round2(Math.min(d.value, subtotal));
  const raw = (subtotal * d.value) / 100;
  const capped =
    d.maxDiscountAmount != null ? Math.min(raw, d.maxDiscountAmount) : raw;
  return round2(Math.min(capped, subtotal));
}

/** Candidates with a positive dollar value, best-first; tie-break newest. */
export function orderCandidatesByValue(
  discounts: PlatformDiscountRow[],
  subtotal: number,
): Array<{ discount: PlatformDiscountRow; amount: number }> {
  return discounts
    .map((d) => ({ discount: d, amount: computeDiscountValue(d, subtotal) }))
    .filter((c) => c.amount > 0)
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        b.discount.createdAt.getTime() - a.discount.createdAt.getTime(),
    );
}
