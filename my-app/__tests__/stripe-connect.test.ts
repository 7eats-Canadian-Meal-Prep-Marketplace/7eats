import { describe, expect, it } from "vitest";
import {
  isStripeFullyConnected,
  readStripeConnectAccountStatus,
} from "@/lib/stripe-connect";

describe("stripe-connect", () => {
  it("treats charges and payouts enabled as connected", () => {
    expect(
      isStripeFullyConnected({
        hasAccount: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        cardPaymentsActive: false,
        transfersActive: false,
      }),
    ).toBe(true);
  });

  it("falls back to active capabilities when enabled flags lag", () => {
    expect(
      isStripeFullyConnected({
        hasAccount: true,
        chargesEnabled: false,
        payoutsEnabled: false,
        cardPaymentsActive: true,
        transfersActive: true,
      }),
    ).toBe(true);
  });

  it("maps Stripe account fields into status", () => {
    expect(
      readStripeConnectAccountStatus({
        id: "acct_123",
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
        capabilities: {
          card_payments: "active",
          transfers: "pending",
        },
        requirements: { currently_due: ["external_account"] },
      } as never),
    ).toMatchObject({
      hasAccount: true,
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
      cardPaymentsActive: true,
      transfersActive: false,
      requirementsCount: 1,
    });
  });
});
