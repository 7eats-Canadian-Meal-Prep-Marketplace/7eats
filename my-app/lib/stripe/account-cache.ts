import type Stripe from "stripe";

/**
 * Burst/multi-tab guard for the live Stripe account retrieve used by the cook
 * dashboard status endpoint.
 *
 * The `StripeConnectPanel` polls `/status` while a cook finishes onboarding, and
 * returning to the tab fires `focus` + `pageshow` + `visibilitychange` almost
 * simultaneously. Each of those — plus any extra panel mounts or open tabs — would
 * otherwise become its own `stripe.v2.core.accounts.retrieve` round-trip.
 *
 * This collapses that redundancy two ways:
 *  - **In-flight coalescing:** concurrent calls for the same account share one
 *    Stripe request and resolve from the same promise. Zero staleness.
 *  - **Short TTL:** results are reused for {@link CACHE_TTL_MS}. Kept well under
 *    the panel's poll cadence so a cook who *just* completed onboarding still
 *    sees "Connected" flip on the next poll rather than waiting out a long cache.
 *
 * The cache lives in module scope, so it is per-server-instance (warm Fluid
 * Compute instances reuse it; cold starts simply repopulate it). It is a best-
 * effort rate-limit cushion for the Stripe API, not a correctness mechanism.
 */

type StripeAccount = Stripe.V2.Core.Account;

type CacheEntry = {
  expiresAt: number;
  account: StripeAccount;
};

/** Reuse a retrieved account for this long before hitting Stripe again. */
const CACHE_TTL_MS = 5000;

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<StripeAccount>>();

/**
 * Retrieve a connected account, coalescing concurrent calls and reusing a recent
 * result, for the same `accountId`. `retrieve` performs the actual Stripe call.
 */
export async function getCachedStripeAccount(
  accountId: string,
  retrieve: () => Promise<StripeAccount>,
  now: number = Date.now(),
): Promise<StripeAccount> {
  const cached = cache.get(accountId);
  if (cached && cached.expiresAt > now) {
    return cached.account;
  }

  const pending = inFlight.get(accountId);
  if (pending) return pending;

  const request = retrieve()
    .then((account) => {
      cache.set(accountId, { account, expiresAt: now + CACHE_TTL_MS });
      return account;
    })
    .finally(() => {
      inFlight.delete(accountId);
    });

  inFlight.set(accountId, request);
  return request;
}
