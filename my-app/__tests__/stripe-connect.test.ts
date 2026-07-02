import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCookStripeProfileDefaults,
  cookMarketplaceProfileUrl,
  isStripeFullyConnected,
  readStripeConnectAccountStatus,
} from "@/lib/stripe/connect";

function v2Account(
  overrides: Partial<{
    transfersStatus: "active" | "pending" | "restricted" | "unsupported";
    requirements: Array<{
      description: string;
      awaiting_action_from: "user" | "stripe";
    }>;
  }> = {},
): Stripe.V2.Core.Account {
  return {
    id: "acct_123",
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: {
              status: overrides.transfersStatus ?? "restricted",
            },
          },
        },
      },
    },
    requirements: {
      entries: (overrides.requirements ?? []).map((r) => ({
        description: r.description,
        awaiting_action_from: r.awaiting_action_from,
      })),
    },
  } as unknown as Stripe.V2.Core.Account;
}

describe("stripe-connect (Accounts v2)", () => {
  it("treats an active stripe_transfers capability as fully connected", () => {
    const status = readStripeConnectAccountStatus(
      v2Account({ transfersStatus: "active" }),
    );
    expect(status.transfersActive).toBe(true);
    expect(status.payoutsEnabled).toBe(true);
    expect(isStripeFullyConnected(status)).toBe(true);
  });

  it("is not connected while the transfers capability is restricted", () => {
    const status = readStripeConnectAccountStatus(
      v2Account({ transfersStatus: "restricted" }),
    );
    expect(status.transfersActive).toBe(false);
    expect(isStripeFullyConnected(status)).toBe(false);
  });

  it("counts only requirements awaiting the cook, not Stripe", () => {
    const status = readStripeConnectAccountStatus(
      v2Account({
        transfersStatus: "restricted",
        requirements: [
          {
            description: "identity.individual.id_number",
            awaiting_action_from: "user",
          },
          { description: "external_account", awaiting_action_from: "user" },
          {
            description: "configuration.merchant.mcc",
            awaiting_action_from: "stripe",
          },
        ],
      }),
    );
    expect(status.requirementsCount).toBe(2);
    expect(status.requirements).toEqual([
      "identity.individual.id_number",
      "external_account",
    ]);
    expect(status.onboardingComplete).toBe(false);
  });

  it("returns an empty status when there is no account", () => {
    const status = readStripeConnectAccountStatus(null);
    expect(status).toMatchObject({
      hasAccount: false,
      transfersActive: false,
      payoutsEnabled: false,
      onboardingComplete: false,
      requirementsCount: 0,
      requirements: [],
    });
    expect(isStripeFullyConnected(status)).toBe(false);
  });

  it("builds Stripe profile defaults from the cook's 7eats storefront URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.7eats.ca");

    expect(cookMarketplaceProfileUrl("cook_abc")).toBe(
      "https://www.7eats.ca/app/cooks/cook_abc",
    );

    expect(
      buildCookStripeProfileDefaults({
        cookProfileId: "cook_abc",
        displayName: "Maria's Kitchen",
      }),
    ).toEqual({
      business_url: "https://www.7eats.ca/app/cooks/cook_abc",
      doing_business_as: "Maria's Kitchen",
      product_description: "Maria's Kitchen sells homemade meals on 7eats.",
    });
  });
});
