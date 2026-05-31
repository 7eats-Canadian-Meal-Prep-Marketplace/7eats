import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { constructEventMock } = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  clientSubscriptions: {},
  cookPayouts: {},
  cookProfiles: {},
  dishes: {},
  listingDishes: {},
  listingSubscriptionTiers: {},
  orderDishes: {},
  orderPayments: {},
  orders: {},
  stripeWebhookEvents: { id: "id" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));
vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent: constructEventMock };
  },
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/webhooks/stripe/route";
import { db } from "@/db";

function makeRequest(event: unknown, signature?: string): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (signature !== undefined) headers["stripe-signature"] = signature;
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: JSON.stringify(event),
    headers,
  });
}

// select chain ending in .limit() -> rows
function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

// select chain for listingDishes: .from().innerJoin().where() -> rows
function joinChain(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ innerJoin }));
  return { from } as never;
}

let insertValues: ReturnType<typeof vi.fn>;
let updateSet: ReturnType<typeof vi.fn>;
let deleteWhere: ReturnType<typeof vi.fn>;

function mockInsert(returnedRow: object) {
  const returning = vi.fn().mockResolvedValue([returnedRow]);
  const onConflictDoNothing = vi.fn(() => ({ returning }));
  insertValues = vi.fn(() => ({ returning, onConflictDoNothing }));
  vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);
}

// Simulates the idempotency insert finding an existing event: the
// onConflictDoNothing().returning() resolves to [] (nothing inserted).
function mockDuplicateInsert() {
  const returning = vi.fn().mockResolvedValue([]);
  const onConflictDoNothing = vi.fn(() => ({ returning }));
  insertValues = vi.fn(() => ({ returning, onConflictDoNothing }));
  vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);
}

function mockUpdate() {
  const where = vi.fn().mockResolvedValue(undefined);
  updateSet = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set: updateSet } as never);
}

function mockDelete() {
  deleteWhere = vi.fn().mockResolvedValue(undefined);
  vi.mocked(db.delete).mockReturnValue({ where: deleteWhere } as never);
}

const SUB_ID = "sub_123";

function paymentSucceededEvent() {
  return {
    type: "invoice.payment_succeeded",
    data: {
      object: {
        parent: {
          type: "subscription_details",
          subscription_details: { subscription: SUB_ID },
        },
        period_start: 1_699_000_000,
        period_end: 1_700_000_000,
        payments: {
          data: [{ is_default: true, payment: { payment_intent: "pi_123" } }],
        },
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no secret + no key -> route parses the body as JSON directly.
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  mockUpdate();
  mockDelete();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Stripe webhook signature verification", () => {
  it("returns 400 when a signing secret is configured but the signature header is missing", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");

    const res = await POST(makeRequest(paymentSucceededEvent()));

    expect(res.status).toBe(400);
    expect(constructEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 when signature verification throws", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
    constructEventMock.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const res = await POST(makeRequest(paymentSucceededEvent(), "bad-sig"));

    expect(res.status).toBe(400);
  });
});

describe("invoice.payment_succeeded", () => {
  it("creates an order, snapshots dishes, and records payment with correct fee math", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1)
        return limitChain([
          {
            id: "subrow-1",
            clientId: "client-1",
            listingId: "listing-1",
            tierId: "tier-1",
            cookId: "cook-1",
          },
        ]);
      if (call === 2) return limitChain([{ price: "20.00" }]);
      if (call === 3) return limitChain([{ platformFeePct: "15.00" }]);
      // listingDishes snapshot
      return joinChain([
        { dishId: "dish-1", quantity: 1, sortOrder: 0, dishName: "Tacos" },
      ]);
    });
    mockInsert({ id: "order-1" });

    const res = await POST(makeRequest(paymentSucceededEvent()));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);

    // Find the orderPayments insert by its distinctive fee fields.
    const paymentInsert = insertValues.mock.calls.find(
      (c) => c[0] && typeof c[0] === "object" && "platformFeeAmount" in c[0],
    )?.[0];
    expect(paymentInsert).toMatchObject({
      totalAmount: "20.00",
      platformFeePct: "15.00",
      platformFeeAmount: "3.00",
      cookPayoutAmount: "17.00",
      stripePaymentIntentId: "pi_123",
    });
  });

  it("no-ops when the subscription is unknown", async () => {
    vi.mocked(db.select).mockImplementation(() => limitChain([]));
    mockInsert({ id: "order-1" });

    const res = await POST(makeRequest(paymentSucceededEvent()));

    expect(res.status).toBe(200);
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe("idempotency", () => {
  function withSubscriptionData() {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1)
        return limitChain([
          {
            id: "subrow-1",
            clientId: "client-1",
            listingId: "listing-1",
            tierId: "tier-1",
            cookId: "cook-1",
          },
        ]);
      if (call === 2) return limitChain([{ price: "20.00" }]);
      if (call === 3) return limitChain([{ platformFeePct: "15.00" }]);
      return joinChain([]);
    });
  }

  it("records the event id and processes a first-time delivery", async () => {
    withSubscriptionData();
    mockInsert({ id: "order-1" });

    const res = await POST(
      makeRequest({ id: "evt_1", ...paymentSucceededEvent() }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicate).toBeUndefined();
    // First insert is the idempotency ledger row keyed on the event id.
    expect(insertValues.mock.calls[0]?.[0]).toMatchObject({
      id: "evt_1",
      type: "invoice.payment_succeeded",
    });
  });

  it("acknowledges a duplicate delivery without re-running side effects", async () => {
    mockDuplicateInsert();

    const res = await POST(
      makeRequest({ id: "evt_1", ...paymentSucceededEvent() }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicate).toBe(true);
    // We bail out before touching any subscription/order tables.
    expect(db.select).not.toHaveBeenCalled();
  });

  it("rolls back the idempotency marker when processing fails", async () => {
    mockInsert({ id: "evt_2" });
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("db exploded");
    });

    const res = await POST(
      makeRequest({ id: "evt_2", ...paymentSucceededEvent() }),
    );

    expect(res.status).toBe(500);
    // The marker is deleted so Stripe's retry can reprocess the event.
    expect(deleteWhere).toHaveBeenCalled();
  });
});

describe("subscription lifecycle events", () => {
  it("invoice.payment_failed marks the subscription past_due", async () => {
    const res = await POST(
      makeRequest({
        type: "invoice.payment_failed",
        data: {
          object: {
            parent: {
              type: "subscription_details",
              subscription_details: { subscription: SUB_ID },
            },
          },
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "past_due" }),
    );
  });

  it("customer.subscription.deleted marks it cancelled", async () => {
    const res = await POST(
      makeRequest({
        type: "customer.subscription.deleted",
        data: { object: { id: SUB_ID } },
      }),
    );
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
  });

  it("customer.subscription.updated maps active status through", async () => {
    const res = await POST(
      makeRequest({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: SUB_ID,
            status: "active",
            cancel_at_period_end: false,
            current_period_start: 1_699_000_000,
            current_period_end: 1_700_000_000,
          },
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" }),
    );
  });
});

describe("payout events", () => {
  it("payout.created inserts a cook payout converted from cents", async () => {
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ id: "cook-1" }]),
    );
    mockInsert({ id: "payout-row" });

    const res = await POST(
      makeRequestWithAccount({
        type: "payout.created",
        data: {
          object: {
            id: "po_1",
            amount: 5000,
            currency: "cad",
            arrival_date: 1_700_000_000,
          },
        },
      }),
    );

    expect(res.status).toBe(200);
    const inserted = insertValues.mock.calls[0]?.[0];
    expect(inserted).toMatchObject({
      cookId: "cook-1",
      stripePayoutId: "po_1",
      amount: "50.00",
      currency: "CAD",
      status: "pending",
    });
  });

  it("payout.paid marks the payout paid", async () => {
    const res = await POST(
      makeRequest({
        type: "payout.paid",
        data: { object: { id: "po_1" } },
      }),
    );
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid" }),
    );
  });

  it("payout.failed marks the payout failed", async () => {
    const res = await POST(
      makeRequest({
        type: "payout.failed",
        data: { object: { id: "po_1" } },
      }),
    );
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
});

describe("misc", () => {
  it("acknowledges unknown event types with 200", async () => {
    const res = await POST(
      makeRequest({ type: "charge.refunded", data: { object: {} } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("returns 500 when a handler throws", async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("db exploded");
    });
    const res = await POST(makeRequest(paymentSucceededEvent()));
    expect(res.status).toBe(500);
  });
});

// Connect events carry an `account` field at the top level of the event.
function makeRequestWithAccount(event: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: JSON.stringify({ ...event, account: "acct_123" }),
    headers: { "content-type": "application/json" },
  });
}
