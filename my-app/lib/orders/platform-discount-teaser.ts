import {
  computeDiscountValue,
  orderCandidatesByValue,
  type PlatformDiscountRow,
} from "./platform-discount";

export type PlatformDiscountTeaser = {
  discountId: string;
  name: string;
  headline: string;
  qualifier: string | null;
  /** Dollar value at the given subtotal (0 when below minimum). */
  projectedAmount: number;
};

function formatMoney(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return rounded % 1 === 0
    ? `$${rounded.toFixed(0)}`
    : `$${rounded.toFixed(2)}`;
}

export function formatPlatformDiscountHeadline(
  discount: PlatformDiscountRow,
): string {
  if (discount.discountType === "fixed") {
    return `Get ${formatMoney(discount.value)} off`;
  }
  return `Get ${discount.value}% off`;
}

export function formatPlatformDiscountQualifier(
  discount: PlatformDiscountRow,
): string | null {
  const parts: string[] = [];
  if (discount.minOrderSubtotal != null) {
    parts.push(`on orders over ${formatMoney(discount.minOrderSubtotal)}`);
  }
  if (
    discount.discountType === "percentage" &&
    discount.maxDiscountAmount != null
  ) {
    parts.push(`up to ${formatMoney(discount.maxDiscountAmount)} off`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

function teaserReferenceSubtotal(
  discounts: PlatformDiscountRow[],
  subtotal?: number,
): number {
  if (subtotal != null && subtotal > 0) return subtotal;
  const mins = discounts
    .map((d) => d.minOrderSubtotal)
    .filter((n): n is number => n != null && n > 0);
  return mins.length > 0 ? Math.max(...mins) : 50;
}

/** Best active platform offer to show signed-out shoppers. */
export function buildPlatformDiscountTeaser(
  discounts: PlatformDiscountRow[],
  name: string,
  subtotal?: number,
): PlatformDiscountTeaser | null {
  if (discounts.length === 0) return null;

  const reference = teaserReferenceSubtotal(discounts, subtotal);
  const candidates = orderCandidatesByValue(discounts, reference);
  const picked =
    candidates[0] ??
    [...discounts]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((discount) => ({
        discount,
        amount: computeDiscountValue(discount, reference),
      }))[0];

  if (!picked) return null;

  const effectiveSubtotal =
    subtotal != null && subtotal > 0 ? subtotal : reference;
  const projectedAmount = computeDiscountValue(
    picked.discount,
    effectiveSubtotal,
  );

  return {
    discountId: picked.discount.id,
    name,
    headline: formatPlatformDiscountHeadline(picked.discount),
    qualifier: formatPlatformDiscountQualifier(picked.discount),
    projectedAmount,
  };
}
