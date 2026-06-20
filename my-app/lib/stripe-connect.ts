import type Stripe from "stripe";

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
