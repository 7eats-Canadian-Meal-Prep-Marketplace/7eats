export type PromotionWindow = {
  maxUses?: number | null;
  validUntil?: string | null;
};

/**
 * A dish promotion must set exactly one of `maxUses` or `validUntil` (XOR), and
 * when an end date is given it must be in the future. This is enforced at the
 * API layer because it cannot be expressed as a DB check constraint.
 */
export function validatePromotionWindow(
  w: PromotionWindow,
): { ok: true } | { ok: false; error: string } {
  const hasMaxUses = w.maxUses !== undefined && w.maxUses !== null;
  const hasValidUntil = w.validUntil !== undefined && w.validUntil !== null;
  if (hasMaxUses === hasValidUntil) {
    return {
      ok: false,
      error: "Set exactly one of an end date or a max redemptions limit.",
    };
  }
  if (hasValidUntil && new Date(w.validUntil as string) <= new Date()) {
    return { ok: false, error: "End date must be in the future." };
  }
  return { ok: true };
}
