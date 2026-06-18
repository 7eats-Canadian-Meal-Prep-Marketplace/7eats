// Client-safe refund-policy helpers (no DB imports — usable in client components).

export const LEAD_TIME_HOURS_MAP: Record<string, number> = {
  same_day: 0,
  "1_day": 24,
  "2_days": 48,
  "3_days": 72,
  "4_days": 96,
  "5_days": 120,
};

/**
 * The latest moment a client can cancel for a refund: pickupAt minus the cook's
 * lead time. Returns null when there is no pickup time yet.
 */
export function cancelByDate(
  pickupAtIso: string | null,
  leadTime: string | null,
): Date | null {
  if (!pickupAtIso) return null;
  const pickup = new Date(pickupAtIso);
  if (Number.isNaN(pickup.getTime())) return null;
  const hours = leadTime ? (LEAD_TIME_HOURS_MAP[leadTime] ?? 0) : 0;
  return new Date(pickup.getTime() - hours * 3600_000);
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Human-readable cancellation policy for a cook + a (possibly chosen) pickup
 * time. Used in the menu summary, cart, and checkout disclaimers.
 */
export function refundPolicyText(
  cancellationAllowed: boolean,
  pickupAtIso: string | null,
  leadTime: string | null,
): string {
  if (!cancellationAllowed) {
    return "All sales are final. This cook does not accept cancellations or refunds.";
  }
  const cutoff = cancelByDate(pickupAtIso, leadTime);
  if (!cutoff) {
    return "You can cancel for a full refund up until this cook's lead time before pickup.";
  }
  return `You can cancel for a full refund until ${formatDateTime(cutoff)}. After that, the sale is final.`;
}
