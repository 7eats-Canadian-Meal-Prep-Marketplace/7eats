import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createPiMock, cancelPiMock } = vi.hoisted(() => ({
  createPiMock: vi.fn(),
  cancelPiMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  dbPool: {
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([]),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    ),
  },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
  dishes: {},
  listingDishes: {},
  listingPromotions: {},
  listings: {},
  orderDishes: {},
  orderPayments: {},
  orders: {},
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));

vi.mock("@/lib/stripe-payments", () => ({
  createFullPaymentIntent: createPiMock,
  createSplitPaymentIntents: vi.fn(),
  cancelPaymentIntent: cancelPiMock,
}));

vi.mock("@/lib/stripe-subscriptions", () => ({
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue("cus_test"),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/orders/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/orders", {
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

const LISTING_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const COOK_ID = "b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6";

const VALID_BODY = {
  listingId: LISTING_ID,
  quantity: 1,
  paymentMethodId: "pm_test_123",
  pickupAt: new Date(Date.now() + 86400000).toISOString(),
};

const ACTIVE_LISTING = {
  id: LISTING_ID,
  cookId: COOK_ID,
  type: "one_time",
  status: "active",
  basePrice: "20.00",
  minOrderQty: 1,
  maxOrderQty: null,
  depositEnabled: false,
  depositType: null,
  depositValue: null,
  title: "Test Listing",
};

const COOK = {
  stripeAccountId: "acct_test",
  platformFeePct: "7.50",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", role: "client", email: "client@test.com" },
  } as never);
  createPiMock.mockResolvedValue({
    piId: "pi_test",
    status: "requires_capture",
    clientSecret: null,
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/orders", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is a cook not a client", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "cook", email: "cook@test.com" },
    } as never);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 404 when listing is not active", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([]); // listing not found
      return limitChain([]);
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it("returns 400 when listing type is subscription", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1)
        return limitChain([{ ...ACTIVE_LISTING, type: "subscription" }]);
      return limitChain([]);
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/subscription/i);
  });

  it("returns 400 when cook has no Stripe account", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([ACTIVE_LISTING]);
      if (call === 2)
        return limitChain([{ stripeAccountId: null, platformFeePct: "7.50" }]);
      return limitChain([]);
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("creates order and payment intent for a no-deposit listing", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([ACTIVE_LISTING]);
      if (call === 2) return limitChain([COOK]);
      if (call === 3)
        return limitChain([
          {
            stripeCustomerId: "cus_existing",
            email: "c@t.com",
            firstName: "A",
            lastName: "B",
          },
        ]);
      return limitChain([]);
    });
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    } as never);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.orderId).toBeDefined();
    expect(createPiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmountCents: 2000,
        platformFeeCents: 150,
        connectedAccountId: "acct_test",
      }),
    );
  });

  it("cancels the PI and returns 500 when DB transaction fails", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([ACTIVE_LISTING]);
      if (call === 2) return limitChain([COOK]);
      if (call === 3)
        return limitChain([
          { stripeCustomerId: "cus_existing", email: "c@t.com" },
        ]);
      return limitChain([]);
    });
    const { dbPool } = await import("@/db");
    vi.mocked(dbPool.transaction).mockRejectedValue(new Error("db error"));

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect(cancelPiMock).toHaveBeenCalledWith("pi_test", expect.any(String));
  });
});
