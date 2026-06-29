import {
  INTERVAL_RECURRENCE_PHRASES,
  type SubscriptionInterval,
} from "@/lib/stripe/subscription-schedule";

/** Charge disclaimer shown on listing, cart, and checkout pages. */
export function getChargeDisclaimer(interval: SubscriptionInterval): string {
  return `You'll be charged automatically ${INTERVAL_RECURRENCE_PHRASES[interval]} until you unsubscribe. Cancel any time from Account → Subscriptions.`;
}

/** Short inline charge note shown near order controls. */
export function getChargeShort(interval: SubscriptionInterval): string {
  return `Charged ${INTERVAL_RECURRENCE_PHRASES[interval]} · cancel any time`;
}
