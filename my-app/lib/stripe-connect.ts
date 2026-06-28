import type Stripe from "stripe";

export type CookStripeProfileInput = {
  cookProfileId: string;
  displayName?: string | null;
};

/** Public storefront URL Stripe can use when a cook has no personal website. */
export function cookMarketplaceProfileUrl(cookProfileId: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://www.7eats.ca"
  ).replace(/\/$/, "");
  return `${base}/app/cooks/${cookProfileId}`;
}

/** Prefill Stripe onboarding so cooks aren't asked for a website they don't have. */
export function buildCookStripeProfileDefaults(cook: CookStripeProfileInput): {
  business_url: string;
  doing_business_as?: string;
  product_description: string;
} {
  const name = cook.displayName?.trim();
  const business_url = cookMarketplaceProfileUrl(cook.cookProfileId);
  return {
    business_url,
    ...(name ? { doing_business_as: name } : {}),
    product_description: name
      ? `${name} sells homemade meals on 7eats.`
      : "Homemade meals sold on 7eats.",
  };
}

export async function syncCookStripeProfileToAccount(
  stripe: Stripe,
  stripeAccountId: string,
  cook: CookStripeProfileInput,
): Promise<void> {
  await stripe.v2.core.accounts.update(stripeAccountId, {
    defaults: { profile: buildCookStripeProfileDefaults(cook) },
  });
}

/**
 * Status of a cook's Accounts v2 connected account.
 *
 * 7eats uses **destination charges without `on_behalf_of`**, so cooks are
 * modeled as v2 `recipient` configurations: they receive transferred funds and
 * payouts, but the platform is the merchant of record. The single meaningful
 * "can this cook get paid" signal is the `stripe_transfers` capability status.
 */
export type StripeConnectAccountStatus = {
  hasAccount: boolean;
  /** `recipient.stripe_balance.stripe_transfers` capability is `active`. */
  transfersActive: boolean;
  /** Ready to receive payouts (transfers active + onboarding complete). */
  payoutsEnabled: boolean;
  /** No outstanding requirements the cook still needs to act on. */
  onboardingComplete: boolean;
  /** Count of requirements still awaiting action from the cook. */
  requirementsCount: number;
  /** Machine-readable descriptions of requirements awaiting the cook. */
  requirements: string[];
};

const EMPTY_STATUS: StripeConnectAccountStatus = {
  hasAccount: false,
  transfersActive: false,
  payoutsEnabled: false,
  onboardingComplete: false,
  requirementsCount: 0,
  requirements: [],
};

export function readStripeConnectAccountStatus(
  account: Stripe.V2.Core.Account | null | undefined,
): StripeConnectAccountStatus {
  if (!account) return { ...EMPTY_STATUS };

  const transfersStatus =
    account.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status;
  const transfersActive = transfersStatus === "active";

  // Only requirements Stripe is waiting on the *user* (cook) for are actionable;
  // entries awaiting Stripe never block the cook and shouldn't surface as todos.
  const pending = (account.requirements?.entries ?? []).filter(
    (entry) => entry.awaiting_action_from === "user",
  );

  return {
    hasAccount: true,
    transfersActive,
    payoutsEnabled: transfersActive,
    onboardingComplete: pending.length === 0,
    requirementsCount: pending.length,
    requirements: pending.map((entry) => entry.description),
  };
}

/** Ready to accept orders and receive payouts. */
export function isStripeFullyConnected(
  status: Pick<StripeConnectAccountStatus, "hasAccount" | "transfersActive">,
): boolean {
  return status.hasAccount && status.transfersActive;
}
