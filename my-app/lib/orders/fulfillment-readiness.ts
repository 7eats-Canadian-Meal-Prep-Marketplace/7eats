/**
 * Payment statuses from which a non-deposit order payment can still be
 * collected (captured/transferred) or has already been collected. Anything
 * else — most importantly `pending` — means the customer's funds were never
 * authorized. An order in that state must NOT be marched to `ready` or
 * `fulfilled`: doing so hands over the food while the card is never charged and
 * the cook is never paid (the silent root cause of "cook earned nothing").
 */
export const COLLECTIBLE_PAYMENT_STATUSES = [
  "authorized", // one-time PI awaiting capture at pickup
  "held", // subscription funds captured on the platform, awaiting transfer
  "released", // already captured/transferred to the cook
] as const;

type CollectiblePaymentStatus = (typeof COLLECTIBLE_PAYMENT_STATUSES)[number];

type PaymentLike = { type: string; status: string };

function isCollectible(status: string): status is CollectiblePaymentStatus {
  return (COLLECTIBLE_PAYMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Returns the first non-deposit payment that cannot be collected, or
 * `undefined` when every non-deposit payment is collectible (or already
 * collected). Deposit rows are excluded because they are captured at order
 * confirmation, not at pickup.
 */
export function findUncollectiblePayment<T extends PaymentLike>(
  payments: T[],
): T | undefined {
  return payments.find((p) => p.type !== "deposit" && !isCollectible(p.status));
}
