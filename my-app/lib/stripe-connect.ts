import type Stripe from "stripe";

export type StripeConnectAccountStatus = {
  hasAccount: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  cardPaymentsActive: boolean;
  transfersActive: boolean;
  requirementsCount: number;
  requirements: string[];
};

export function readStripeConnectAccountStatus(
  account: Stripe.Account | null | undefined,
): StripeConnectAccountStatus {
  if (!account) {
    return {
      hasAccount: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      cardPaymentsActive: false,
      transfersActive: false,
      requirementsCount: 0,
      requirements: [],
    };
  }

  const requirements = account.requirements?.currently_due ?? [];

  return {
    hasAccount: true,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    cardPaymentsActive: account.capabilities?.card_payments === "active",
    transfersActive: account.capabilities?.transfers === "active",
    requirementsCount: requirements.length,
    requirements,
  };
}

/** Ready to accept orders and receive payouts. */
export function isStripeFullyConnected(
  status: Pick<
    StripeConnectAccountStatus,
    | "hasAccount"
    | "chargesEnabled"
    | "payoutsEnabled"
    | "cardPaymentsActive"
    | "transfersActive"
  >,
): boolean {
  if (!status.hasAccount) return false;
  if (status.chargesEnabled && status.payoutsEnabled) return true;
  return status.cardPaymentsActive && status.transfersActive;
}

export function stripeAccountLinkType(
  account: Stripe.Account,
): "account_onboarding" | "account_update" {
  return account.details_submitted ? "account_update" : "account_onboarding";
}
