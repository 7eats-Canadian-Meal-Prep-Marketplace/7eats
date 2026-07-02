import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  orders: {},
  cookProfiles: {},
  orderPayments: {},
  authUser: {},
  orderDishes: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));
vi.mock("@/lib/stripe/payments", () => ({
  capturePaymentIntent: vi.fn().mockResolvedValue(undefined),
  cancelPaymentIntent: vi.fn().mockResolvedValue(undefined),
  partialCapturePaymentIntent: vi.fn().mockResolvedValue(undefined),
  refundPaymentIntent: vi.fn().mockResolvedValue("re_test123"),
}));
vi.mock("@/lib/emails/order-events", () => ({
  sendOrderConfirmedEmailToClient: vi.fn().mockResolvedValue(undefined),
  sendOrderNotReadyEmailToClient: vi.fn().mockResolvedValue(undefined),
  sendOrderReadyEmailToClient: vi.fn().mockResolvedValue(undefined),
  sendOrderCancelledByCookEmailToClient: vi.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/business/dashboard/orders/[orderId]/status/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
  sendOrderCancelledByCookEmailToClient,
  sendOrderConfirmedEmailToClient,
  sendOrderNotReadyEmailToClient,
  sendOrderReadyEmailToClient,
} from "@/lib/emails/order-events";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  refundPaymentIntent,
} from "@/lib/stripe/payments";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const COOK_USER_ID = "cook-user-uuid";

const params = Promise.resolve({ orderId: ORDER_ID });

function makePatch(body: unknown, orderId = ORDER_ID): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/dashboard/orders/${orderId}/status`,
    {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    },
  );
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "cook" } } as never) : null,
  );
}

function mockCook(found: boolean) {
  const limit = vi.fn().mockResolvedValue(found ? [{ id: COOK_ID }] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

type OrderTiming = {
  pickupAt?: Date | null;
  fulfillmentWindowStart?: Date | null;
  fulfillmentWindowEnd?: Date | null;
  fulfillmentMode?: "pickup" | "delivery";
  deliveryAddress?: object | null;
};

function orderChain(status: string, timing: OrderTiming = {}) {
  const limit = vi.fn().mockResolvedValue([
    {
      id: ORDER_ID,
      cookId: COOK_ID,
      status,
      pickupAt:
        "pickupAt" in timing
          ? timing.pickupAt
          : new Date(Date.now() + 2 * 3600_000),
      fulfillmentWindowStart: timing.fulfillmentWindowStart ?? null,
      fulfillmentWindowEnd: timing.fulfillmentWindowEnd ?? null,
      fulfillmentMode: timing.fulfillmentMode ?? "pickup",
      deliveryAddress: timing.deliveryAddress ?? null,
    },
  ]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function orderChainEmpty() {
  const limit = vi.fn().mockResolvedValue([]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** Returns a select chain that resolves to an empty deposit payment list. */
function noDepositPayment() {
  const limit = vi.fn().mockResolvedValue([]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** Returns a select chain that resolves with a deposit payment. */
function depositPaymentChain(piId = "pi_deposit_123") {
  const limit = vi
    .fn()
    .mockResolvedValue([{ id: "pay-uuid", stripePaymentIntentId: piId }]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** Returns a select chain for all-payments query (no limit, just where). */
function allPaymentsChain(
  payments: Array<{
    id: string;
    type: string;
    status: string;
    stripePaymentIntentId: string | null;
    totalAmount: string;
    cookPayoutAmount: string | null;
    platformFeePct: string;
  }>,
) {
  const where = vi.fn().mockResolvedValue(payments);
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** Returns a select chain for the ready-guard payment lookup (no limit). */
function readyPaymentsChain(
  payments: Array<{ type: string; status: string }> = [
    { type: "full", status: "authorized" },
  ],
) {
  const where = vi.fn().mockResolvedValue(payments);
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** Returns a select chain for the cookProfiles userId lookup on cancel. */
function cookUserChain(userId: string | null = COOK_USER_ID) {
  const limit = vi.fn().mockResolvedValue(userId ? [{ userId }] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** Query-shape-agnostic chain that resolves to `rows` when awaited. */
function thenable(rows: unknown[]) {
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

/**
 * The fire-and-forget email lookup (client + cook) followed by a second select
 * for the order's dish names. Both are returned as shape-agnostic thenables.
 */
function emailLookupChain() {
  return thenable([
    {
      clientEmail: "client@test.com",
      clientFirstName: "Client",
      totalPrice: "40.00",
      currency: "CAD",
      pickupAt: new Date(Date.now() + 2 * 3600_000),
      cookName: "Cook Kitchen",
    },
  ]);
}

function mockUpdate(row: object) {
  const returning = vi.fn().mockResolvedValue([row]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
  return { set };
}

/**
 * Sequences db.select calls for a "ready" path:
 * 1. cook lookup
 * 2. order fetch
 * 3. payment readiness guard lookup
 */
function withOrderForReady(
  timing: OrderTiming = {},
  payments: Array<{ type: string; status: string }> = [
    { type: "full", status: "authorized" },
  ],
) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    call++;
    if (call === 1) return mockCook(true);
    if (call === 2) return orderChain("confirmed", timing);
    if (call === 3) return readyPaymentsChain(payments);
    return emailLookupChain();
  });
}

/**
 * Sequences db.select calls for a "confirm" path:
 * 1. cook lookup
 * 2. order fetch
 * 3. deposit payment lookup
 */
function withOrderForConfirm(orderStatus: string, hasDeposit = false) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    call++;
    if (call === 1) return mockCook(true);
    if (call === 2) return orderChain(orderStatus);
    if (call === 3)
      return hasDeposit ? depositPaymentChain() : noDepositPayment();
    return emailLookupChain();
  });
}

/**
 * Sequences db.select calls for a "cancel" path:
 * 1. cook lookup
 * 2. order fetch
 * 3. all-payments fetch
 * 4. cookProfiles userId lookup
 */
function withOrderForCancel(
  orderStatus: string,
  payments: Parameters<typeof allPaymentsChain>[0] = [],
) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    call++;
    if (call === 1) return mockCook(true);
    if (call === 2) return orderChain(orderStatus);
    if (call === 3) return allPaymentsChain(payments);
    if (call === 4) return cookUserChain();
    return emailLookupChain();
  });
}

/**
 * Simple helper for tests that don't care about the payment side (e.g. invalid
 * transition, not-found). Only needs cook + order calls.
 */
function withOrder(status: string) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    call++;
    return call === 1 ? mockCook(true) : orderChain(status);
  });
}

describe("PATCH /api/business/dashboard/orders/[orderId]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession(USER_ID);
  });

  // ─── Auth / input validation ───────────────────────────────────────────────

  it("returns 401 when there is no cook profile", async () => {
    mockSession(null);
    const res = await PATCH(makePatch({ status: "confirmed" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-uuid order ID", async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockCook(true));
    const res = await PATCH(makePatch({ status: "confirmed" }, "nope"), {
      params: Promise.resolve({ orderId: "nope" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockCook(true));
    const res = await PATCH(makePatch("not-json"), { params });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a status outside the allowed enum", async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockCook(true));
    const res = await PATCH(makePatch({ status: "fulfilled" }), { params });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the order does not belong to the cook", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      return call === 1 ? mockCook(true) : orderChainEmpty();
    });
    const res = await PATCH(makePatch({ status: "confirmed" }), { params });
    expect(res.status).toBe(404);
  });

  // ─── Transition guard ──────────────────────────────────────────────────────

  it("rejects an invalid transition (pending -> ready)", async () => {
    withOrder("pending");
    const res = await PATCH(makePatch({ status: "ready" }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid status transition.");
  });

  it("rejects any transition out of a terminal status (fulfilled)", async () => {
    withOrder("fulfilled");
    const res = await PATCH(makePatch({ status: "cancelled" }), { params });
    expect(res.status).toBe(400);
  });

  // ─── Confirm: deposit capture ──────────────────────────────────────────────

  it("allows pending -> confirmed and skips deposit capture when no deposit PI", async () => {
    withOrderForConfirm("pending", false);
    mockUpdate({ id: ORDER_ID, status: "confirmed" });
    const res = await PATCH(makePatch({ status: "confirmed" }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("confirmed");
    expect(capturePaymentIntent).not.toHaveBeenCalled();
  });

  it("captures the deposit PI on confirm when one exists", async () => {
    withOrderForConfirm("pending", true);
    // mockUpdate needs to handle both the deposit update and the order update
    const returning = vi
      .fn()
      .mockResolvedValue([{ id: ORDER_ID, status: "confirmed" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makePatch({ status: "confirmed" }), { params });
    expect(res.status).toBe(200);
    expect(capturePaymentIntent).toHaveBeenCalledWith(
      "pi_deposit_123",
      `deposit-release-${ORDER_ID}`,
    );
  });

  // ─── Ready: pickup code generation ────────────────────────────────────────

  it("rejects ready (402) when the order's payment is still pending", async () => {
    withOrderForReady(undefined, [{ type: "full", status: "pending" }]);
    const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
    const res = await PATCH(makePatch({ status: "ready" }), { params });
    expect(res.status).toBe(402);
    expect(set).not.toHaveBeenCalled(); // never marked ready, no pickup code
  });

  it("generates a pickup code when transitioning to ready", async () => {
    withOrderForReady();
    const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
    const res = await PATCH(makePatch({ status: "ready" }), { params });
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ready",
        pickupCode: expect.stringMatching(/^\d{6}$/),
        pickupCodeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        pickupCodeExpiresAt: expect.any(Date),
        pickupCodeAttempts: 0,
      }),
    );
  });

  it("sets expiry to at least 24h from now when the schedule is in the past", async () => {
    const pickupAt = new Date(Date.now() - 2 * 3600_000); // pickup was 2h ago
    withOrderForReady({ pickupAt });
    const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
    const before = new Date(Date.now() + 24 * 3600_000 - 1000);
    await PATCH(makePatch({ status: "ready" }), { params });
    const callArgs = (set as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    const expiry = callArgs.pickupCodeExpiresAt as Date;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(expiry.getTime()).toBeLessThan(before.getTime() + 25 * 3_600_000);
  });

  it("sets expiry to 6h after the latest time in the fulfillment range", async () => {
    // Order scheduled for tomorrow's window (allowed: today is the day before).
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 5, 25, 10, 0, 0)); // Thu Jun 25, 10:00 local
      const windowStart = new Date(2026, 5, 26, 11, 0, 0); // Fri 11:00
      const windowEnd = new Date(2026, 5, 26, 14, 0, 0); // Fri 14:00
      withOrderForReady({
        pickupAt: null,
        fulfillmentWindowStart: windowStart,
        fulfillmentWindowEnd: windowEnd,
      });
      const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
      await PATCH(makePatch({ status: "ready" }), { params });
      const callArgs = (set as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Record<string, unknown>;
      const expiry = callArgs.pickupCodeExpiresAt as Date;
      // Anchored to window END (latest in range), not the start.
      const expected = new Date(windowEnd.getTime() + 6 * 3600_000);
      expect(expiry.getTime()).toBe(expected.getTime());
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects ready (400) when the order is scheduled more than a day out", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 5, 25, 10, 0, 0)); // Thu Jun 25
      const windowStart = new Date(2026, 5, 27, 11, 0, 0); // Sat — two days out
      withOrderForReady({
        pickupAt: null,
        fulfillmentWindowStart: windowStart,
        fulfillmentWindowEnd: new Date(2026, 5, 27, 14, 0, 0),
      });
      const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
      const res = await PATCH(makePatch({ status: "ready" }), { params });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/day before/i);
      expect(set).not.toHaveBeenCalled(); // never marked ready, no pickup code
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows ready on the calendar day before the scheduled window", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 5, 25, 23, 30, 0)); // Thu 23:30 — day before
      withOrderForReady({
        pickupAt: null,
        fulfillmentWindowStart: new Date(2026, 5, 26, 11, 0, 0), // Fri
        fulfillmentWindowEnd: new Date(2026, 5, 26, 14, 0, 0),
      });
      const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
      const res = await PATCH(makePatch({ status: "ready" }), { params });
      expect(res.status).toBe(200);
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ready" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // ─── Ready: delivery arrival time ─────────────────────────────────────────

  // Window: Fri Jun 26 11:00–14:00, "now" = Thu Jun 25 10:00 — the day before,
  // so the order is markable and the window-end expiry anchor (not the 24h
  // floor) is what's exercised.
  function deliveryReady(arrivalAt?: Date) {
    withOrderForReady({
      pickupAt: null,
      fulfillmentMode: "delivery",
      fulfillmentWindowStart: new Date(2026, 5, 26, 11, 0, 0),
      fulfillmentWindowEnd: new Date(2026, 5, 26, 14, 0, 0),
      deliveryAddress: { street: "1 Main St", city: "Toronto", province: "ON" },
    });
    const body: Record<string, unknown> = { status: "ready" };
    if (arrivalAt) body.arrivalAt = arrivalAt.toISOString();
    return body;
  }

  it("rejects delivery ready (400) when no arrival time is provided", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 5, 25, 10, 0, 0));
      const body = deliveryReady(); // no arrivalAt
      const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
      const res = await PATCH(makePatch(body), { params });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/arrival time/i);
      expect(set).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects delivery ready (400) when arrival is outside the window", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 5, 25, 10, 0, 0));
      const body = deliveryReady(new Date(2026, 5, 26, 15, 0, 0)); // after end
      const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
      const res = await PATCH(makePatch(body), { params });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/window/i);
      expect(set).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("sets pickupAt to the chosen arrival time on a valid delivery ready", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 5, 25, 10, 0, 0));
      const arrival = new Date(2026, 5, 26, 12, 30, 0);
      const body = deliveryReady(arrival);
      const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
      const res = await PATCH(makePatch(body), { params });
      expect(res.status).toBe(200);
      const callArgs = (set as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Record<string, unknown>;
      expect((callArgs.pickupAt as Date).getTime()).toBe(arrival.getTime());
      // Expiry anchored to the window end + 6h (latest in range).
      const expiry = callArgs.pickupCodeExpiresAt as Date;
      expect(expiry.getTime()).toBe(
        new Date(2026, 5, 26, 14, 0, 0).getTime() + 6 * 3600_000,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not require an arrival time for pickup orders", async () => {
    withOrderForReady({ fulfillmentMode: "pickup" });
    const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
    const res = await PATCH(makePatch({ status: "ready" }), { params });
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready" }),
    );
  });

  // ─── Cancel: cook voluntary cancellation ──────────────────────────────────

  it("sets cancelledAt when cancelling", async () => {
    withOrderForCancel("pending", []);
    const { set } = mockUpdate({ id: ORDER_ID, status: "cancelled" });
    const res = await PATCH(makePatch({ status: "cancelled" }), { params });
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        cancelledAt: expect.any(Date),
      }),
    );
  });

  it("cancels an authorized payment PI on voluntary cook cancel", async () => {
    const payments = [
      {
        id: "pay-uuid",
        type: "deposit",
        status: "authorized",
        stripePaymentIntentId: "pi_dep_abc",
        totalAmount: "50.00",
        cookPayoutAmount: null,
        platformFeePct: "10.00",
      },
    ];
    withOrderForCancel("pending", payments);
    const returning = vi
      .fn()
      .mockResolvedValue([{ id: ORDER_ID, status: "cancelled" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makePatch({ status: "cancelled" }), { params });
    expect(res.status).toBe(200);
    expect(cancelPaymentIntent).toHaveBeenCalledWith(
      "pi_dep_abc",
      `cook-cancel-${ORDER_ID}-deposit`,
    );
  });

  it("refunds a released deposit when cook cancels after confirmation", async () => {
    const payments = [
      {
        id: "pay-uuid",
        type: "deposit",
        status: "released",
        stripePaymentIntentId: "pi_dep_released",
        totalAmount: "50.00",
        cookPayoutAmount: null,
        platformFeePct: "10.00",
      },
    ];
    withOrderForCancel("confirmed", payments);
    const returning = vi
      .fn()
      .mockResolvedValue([{ id: ORDER_ID, status: "cancelled" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makePatch({ status: "cancelled" }), { params });
    expect(res.status).toBe(200);
    expect(refundPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: "pi_dep_released",
        reverseTransfer: true,
        idempotencyKey: `cook-cancel-deposit-refund-${ORDER_ID}`,
      }),
    );
  });

  it("refunds a held subscription payment when cook cancels voluntarily", async () => {
    const payments = [
      {
        id: "pay-subscription",
        type: "full",
        status: "held",
        stripePaymentIntentId: "pi_subscription_paid",
        totalAmount: "50.00",
        cookPayoutAmount: "45.00",
        platformFeePct: "10.00",
      },
    ];
    withOrderForCancel("confirmed", payments);
    const returning = vi
      .fn()
      .mockResolvedValue([{ id: ORDER_ID, status: "cancelled" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makePatch({ status: "cancelled" }), { params });
    expect(res.status).toBe(200);
    expect(refundPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: "pi_subscription_paid",
        idempotencyKey: `cook-cancel-held-refund-${ORDER_ID}-pay-subscription`,
      }),
    );
  });

  // ─── Cancel: client no-show ────────────────────────────────────────────────

  it("captures authorized payments on client no-show", async () => {
    const payments = [
      {
        id: "pay-balance",
        type: "balance",
        status: "authorized",
        stripePaymentIntentId: "pi_bal_xyz",
        totalAmount: "100.00",
        cookPayoutAmount: null,
        platformFeePct: "10.00",
      },
    ];
    withOrderForCancel("confirmed", payments);
    const returning = vi
      .fn()
      .mockResolvedValue([{ id: ORDER_ID, status: "cancelled" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(
      makePatch({ status: "cancelled", reason: "client_no_show" }),
      { params },
    );
    expect(res.status).toBe(200);
    expect(capturePaymentIntent).toHaveBeenCalledWith(
      "pi_bal_xyz",
      `noshow-capture-${ORDER_ID}-balance`,
    );
    expect(cancelPaymentIntent).not.toHaveBeenCalled();
  });

  // ─── Email side effects ────────────────────────────────────────────────────

  it("sends the confirmed email to the client on confirm", async () => {
    withOrderForConfirm("pending", false);
    mockUpdate({ id: ORDER_ID, status: "confirmed" });
    const res = await PATCH(makePatch({ status: "confirmed" }), { params });
    expect(res.status).toBe(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(sendOrderConfirmedEmailToClient).toHaveBeenCalled();
  });

  it("sends the ready email with the pickup code on ready", async () => {
    withOrderForReady();
    mockUpdate({ id: ORDER_ID, status: "ready" });
    const res = await PATCH(makePatch({ status: "ready" }), { params });
    expect(res.status).toBe(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(sendOrderReadyEmailToClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.stringMatching(/^\d{6}$/),
    );
  });

  it("sends the not-ready email when reverting from ready to confirmed", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return mockCook(true);
      if (call === 2) return orderChain("ready");
      return emailLookupChain();
    });
    mockUpdate({ id: ORDER_ID, status: "confirmed" });
    const res = await PATCH(makePatch({ status: "confirmed" }), { params });
    expect(res.status).toBe(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(sendOrderNotReadyEmailToClient).toHaveBeenCalled();
    expect(sendOrderConfirmedEmailToClient).not.toHaveBeenCalled();
  });

  it("sends the cancelled-by-cook email to the client on cancel", async () => {
    withOrderForCancel("pending", []);
    mockUpdate({ id: ORDER_ID, status: "cancelled" });
    const res = await PATCH(makePatch({ status: "cancelled" }), { params });
    expect(res.status).toBe(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(sendOrderCancelledByCookEmailToClient).toHaveBeenCalled();
  });

  // ─── Error handling ────────────────────────────────────────────────────────

  it("returns 500 on a db error", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return mockCook(true);
      const limit = vi.fn().mockRejectedValue(new Error("db down"));
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await PATCH(makePatch({ status: "confirmed" }), { params });
    expect(res.status).toBe(500);
  });
});
