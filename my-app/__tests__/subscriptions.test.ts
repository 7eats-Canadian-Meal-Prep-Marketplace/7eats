import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  authUserTable: {},
  clientSubscriptions: {},
  cookProfiles: {},
  listingSubscriptionTiers: {},
  listings: {},
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("@/lib/stripe-subscriptions", () => ({
  createStripeSubscription: vi.fn().mockResolvedValue({
    id: "sub_test",
    items: {
      data: [
        {
          current_period_start: 1_700_000_000,
          current_period_end: 1_700_604_800,
        },
      ],
    },
  }),
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue("cus_test"),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/subscriptions/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { createStripeSubscription } from "@/lib/stripe-subscriptions";

const LISTING_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const TIER_ID = "b1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

describe("POST /api/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "client-1", role: "client", email: "client@test.com" },
    } as never);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "subrow-1" }]),
      })),
    } as never);
  });

  it("returns 403 before creating a Stripe subscription when client onboarding is incomplete", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1)
        return limitChain([
          { id: LISTING_ID, cookId: "cook-1", type: "subscription" },
        ]);
      if (call === 2)
        return limitChain([
          { id: TIER_ID, stripePriceId: "price_123", interval: "weekly" },
        ]);
      if (call === 3) return limitChain([]);
      if (call === 4)
        return limitChain([
          { stripeAccountId: "acct_123", platformFeePct: "10.00" },
        ]);
      if (call === 5)
        return limitChain([
          {
            stripeCustomerId: "cus_existing",
            email: "client@test.com",
            firstName: "Client",
            lastName: "User",
            onboardingCompletedAt: null,
          },
        ]);
      return limitChain([]);
    });

    const res = await POST(
      makeReq({
        listingId: LISTING_ID,
        tierId: TIER_ID,
        paymentMethodId: "pm_test",
      }),
    );

    expect(res.status).toBe(403);
    expect(createStripeSubscription).not.toHaveBeenCalled();
  });
});
