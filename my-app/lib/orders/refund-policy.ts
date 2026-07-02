// Client-safe refund-policy helpers (no DB imports — usable in client components).

export {
  describeCancellationPolicy,
  describeLeadTimePolicy,
  formatLeadTime,
  formatLeadTimeCutoffLabel,
  LEAD_TIME_DAYS_MAP,
  type LeadTimeRules,
} from "@/lib/lead-time";

import {
  formatLeadTime,
  cancelByDate as leadCancelByDate,
} from "@/lib/lead-time";

/** @deprecated Use LEAD_TIME_HOURS from lib/lead-time */
export const LEAD_TIME_HOURS_MAP: Record<string, number> = {
  same_day: 0,
  "1_day": 24,
  "2_days": 48,
  "3_days": 72,
  "4_days": 96,
  "5_days": 120,
};

export function cancelByDate(
  pickupAtIso: string | null,
  leadTime: string | null,
  leadTimeCutoff?: string | null,
): Date | null {
  return leadCancelByDate(pickupAtIso, { leadTime, leadTimeCutoff });
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
  leadTimeCutoff?: string | null,
): string {
  if (!cancellationAllowed) {
    return "All sales are final. This cook does not accept cancellations or refunds.";
  }
  const cutoff = cancelByDate(pickupAtIso, leadTime, leadTimeCutoff);
  if (!cutoff) {
    const leadLabel = formatLeadTime(leadTime);
    if (leadLabel) {
      return `You can cancel for a full refund up until ${leadLabel} before your scheduled ${pickupAtIso ? "pickup or delivery" : "fulfillment"}.`;
    }
    return "You can cancel for a full refund up until this cook's lead time before pickup.";
  }
  return `You can cancel for a full refund until ${formatDateTime(cutoff)}. After that, the sale is final.`;
}
