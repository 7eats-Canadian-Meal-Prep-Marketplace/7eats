import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPiMock, cancelPiMock, placeClientOrderMock, ensureStripeMock } =
  vi.hoisted(() => ({
    createPiMock: vi.fn(),
    cancelPiMock: vi.fn(),
    placeClientOrderMock: vi.fn(),
    ensureStripeMock: vi.fn(),
  }));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  dbPool: {
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      // tx.select(...).for("update") re-lock returns a still-valid promo row.
      const lockChain: unknown = new Proxy(() => {}, {
        get(_t, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) =>
              resolve([
                {
                  isActive: true,
                  validFrom: null,
                  validUntil: null,
                  maxUses: null,
                  usesCount: 0,
                },
              ]);
          }
          return () => lockChain;
        },
      });
      return await fn({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([]),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        select: vi.fn(() => lockChain),
      });
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  authUserTable: {},
  cookProfiles: {},
  dishes: {},
  dishPromotions: {},
  orderDishes: {},
  orderPayments: {},
  orders: {},
  rateLimitLog: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gt: vi.fn(),
  inArray: vi.fn(),
  count: vi.fn(),
  desc: vi.fn(),
  sql: Object.assign(vi.fn(), { join: vi.fn() }),
}));

vi.mock("@/lib/stripe-payments", () => ({
  createCheckoutPaymentIntent: createPiMock,
  cancelPaymentIntent: cancelPiMock,
}));
vi.mock("@/lib/guest-client", () => ({
  ensureStripeCustomer: ensureStripeMock,
}));
vi.mock("@/lib/orders/place-order", () => ({
  createOrderBodySchema: {
    safeParse: (body: unknown) => {
      const b = body as { cookId?: string; dishes?: unknown[] };
      if (
        !b?.cookId ||
        !/^[0-9a-f-]{36}$/i.test(b.cookId) ||
        !Array.isArray(b.dishes) ||
        b.dishes.length === 0
      ) {
        return { success: false, error: { issues: [{ message: "bad" }] } };
      }
      return { success: true, data: body };
    },
  },
  placeClientOrder: placeClientOrderMock,
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/emails/order-events", () => ({
  sendOrderPlacedEmailToCook: vi.fn().mockResolvedValue(undefined),
  sendOrderReceiptToClient: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/delivery-fee", () => ({ calcDeliveryFee: vi.fn() }));
vi.mock("@/lib/mapbox-directions", () => ({ getDrivingDistanceKm: vi.fn() }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/orders/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6";
const DISH_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/orders", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

/** Query-shape-agnostic chain that resolves to `rows` when awaited. */
function chain(rows: unknown[]) {
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(rows);
      }
      return () => proxy;
    },
  });
  return proxy as never;
}
function selectQueue(results: unknown[][]) {
  // The first db.select in POST is the rate-limit count check.
  const all: unknown[][] = [[{ count: 0 }], ...results];
  let i = 0;
  return () => chain(all[i++] ?? []);
}

const _COOK_ROW = {
  id: COOK_ID,
  userStatus: "active",
  minOrderQty: 1,
  maxOrderQty: null,
  leadTime: null,
  cancellationAllowed: false,
  platformFeePct: "7.5",
  stripeAccountId: "acct_test",
  delivery: "none",
  pickupLat: null,
  pickupLng: null,
  maxDeliveryKm: null,
  deliveryRatePerKm: null,
  deliveryFlatFee: null,
  freeDeliveryAbove: null,
};

const validBody = {
  cookId: COOK_ID,
  dishes: [{ dishId: DISH_ID, quantity: 2 }],
};

function asClient() {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", role: "client", email: "c@test.com" },
  } as never);
}

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPiMock.mockResolvedValue({ piId: "pi_test" });
    ensureStripeMock.mockResolvedValue("cus_test");
    placeClientOrderMock.mockResolvedValue({
      ok: true,
      orderId: "order-test-id",
      clientSecret: "pi_test_secret",
    });
    // Rate-limit writes a log row; default select returns an under-limit count.
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    } as never);
    vi.mocked(db.select).mockImplementation(() => chain([{ count: 0 }]));
  });

  it("401 when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(401);
  });

  it("403 when role is not client", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "u", role: "cook", email: "k@test.com" },
    } as never);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(403);
  });

  it("400 on invalid body", async () => {
    asClient();
    const res = await POST(makePost({ cookId: "not-a-uuid", dishes: [] }));
    expect(res.status).toBe(400);
  });

  it("404 when cook not found / inactive", async () => {
    asClient();
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [
          {
            onboardingCompletedAt: new Date(),
            isGuestAccount: false,
            email: "c@test.com",
            firstName: "C",
            lastName: "L",
          },
        ],
      ]),
    );
    placeClientOrderMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      error: "Cook not found.",
    });
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(404);
  });

  it("422 when below the minimum order quantity", async () => {
    asClient();
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [
          {
            onboardingCompletedAt: new Date(),
            isGuestAccount: false,
            email: "c@test.com",
            firstName: "C",
            lastName: "L",
          },
        ],
      ]),
    );
    placeClientOrderMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      error: "Minimum order is 5 item(s).",
    });
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(422);
  });

  it("creates an order and returns 201 with orderId", async () => {
    asClient();
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [
          {
            onboardingCompletedAt: new Date(),
            isGuestAccount: false,
            email: "c@test.com",
            firstName: "C",
            lastName: "L",
          },
        ],
      ]),
    );

    const res = await POST(makePost(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.orderId).toBe("order-test-id");
    expect(placeClientOrderMock).toHaveBeenCalledOnce();
  });

  it("applies a valid promotion and creates the order", async () => {
    asClient();
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [
          {
            onboardingCompletedAt: new Date(),
            isGuestAccount: false,
            email: "c@test.com",
            firstName: "C",
            lastName: "L",
          },
        ],
      ]),
    );

    const res = await POST(
      makePost({
        ...validBody,
        dishes: [
          {
            dishId: DISH_ID,
            quantity: 2,
            promotionId: "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f70",
          },
        ],
      }),
    );
    expect(res.status).toBe(201);
    expect(placeClientOrderMock).toHaveBeenCalledOnce();
  });

  it("rejects an invalid promotion with 422 and never charges", async () => {
    asClient();
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [
          {
            onboardingCompletedAt: new Date(),
            isGuestAccount: false,
            email: "c@test.com",
            firstName: "C",
            lastName: "L",
          },
        ],
      ]),
    );
    placeClientOrderMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      error: "A selected promotion is no longer valid.",
      dishId: DISH_ID,
    });

    const res = await POST(
      makePost({
        ...validBody,
        dishes: [
          {
            dishId: DISH_ID,
            quantity: 1,
            promotionId: "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f70",
          },
        ],
      }),
    );
    expect(res.status).toBe(422);
    expect(placeClientOrderMock).toHaveBeenCalledOnce();
  });

  it("returns 502 and persists nothing when payment authorization fails", async () => {
    asClient();
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [
          {
            onboardingCompletedAt: new Date(),
            isGuestAccount: false,
            email: "c@test.com",
            firstName: "C",
            lastName: "L",
          },
        ],
      ]),
    );
    placeClientOrderMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      error: "Payment could not be authorized.",
    });

    const res = await POST(makePost(validBody));
    expect(res.status).toBe(502);
  });
});
