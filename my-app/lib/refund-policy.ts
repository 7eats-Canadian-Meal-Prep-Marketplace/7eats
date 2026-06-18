// Client-safe refund-policy helpers (no DB imports — usable in client components).

export const LEAD_TIME_HOURS_MAP: Record<string, number> = {
  same_day: 0,
  "1_day": 24,
  "2_days": 48,
  "3_days": 72,
  "4_days": 96,
  "5_days": 120,
};

// Whole days of notice a cook requires before a pickup. Lead time is counted in
// calendar days (order Monday with a 3-day lead → eligible from Thursday),
// not rolling hours. Mirror of LEAD_TIME_DAYS in lib/order-pricing.ts.
export const LEAD_TIME_DAYS_MAP: Record<string, number> = {
  same_day: 0,
  "1_day": 1,
  "2_days": 2,
  "3_days": 3,
  "4_days": 4,
  "5_days": 5,
};

const LEAD_TIME_LABELS: Record<string, string> = {
  same_day: "Same day",
  "1_day": "1 day",
  "2_days": "2 days",
  "3_days": "3 days",
  "4_days": "4 days",
  "5_days": "5 days",
};

/**
 * Human-readable label for a cook's lead-time enum value (e.g. "2_days" →
 * "2 days"). Falls back to a de-underscored version for any unmapped value so
 * raw enum keys are never shown to a customer.
 */
export function formatLeadTime(leadTime: string | null): string | null {
  if (!leadTime) return null;
  return LEAD_TIME_LABELS[leadTime] ?? leadTime.replace(/_/g, " ");
}

/**
 * The latest moment a client can cancel for a refund. Lead time is counted in
 * whole calendar days before the pickup day (mirrors earliestPickup / slot picker).
 */
export function cancelByDate(
  pickupAtIso: string | null,
  leadTime: string | null,
): Date | null {
  if (!pickupAtIso) return null;
  const pickup = new Date(pickupAtIso);
  if (Number.isNaN(pickup.getTime())) return null;
  const days = leadTime ? (LEAD_TIME_DAYS_MAP[leadTime] ?? 0) : 0;
  const pickupDay = new Date(
    pickup.getFullYear(),
    pickup.getMonth(),
    pickup.getDate(),
  );
  const exclusive = new Date(
    pickupDay.getFullYear(),
    pickupDay.getMonth(),
    pickupDay.getDate() - days + 1,
  );
  return new Date(exclusive.getTime() - 1);
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
