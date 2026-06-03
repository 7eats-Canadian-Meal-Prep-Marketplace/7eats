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
  listings: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));
vi.mock("@/lib/stripe-payments", () => ({
  capturePaymentIntent: vi.fn().mockResolvedValue(undefined),
  cancelPaymentIntent: vi.fn().mockResolvedValue(undefined),
  partialCapturePaymentIntent: vi.fn().mockResolvedValue(undefined),
  refundPaymentIntent: vi.fn().mockResolvedValue("re_test123"),
}));
vi.mock("@/lib/emails/order-events", () => ({
  sendOrderConfirmedEmailToClient: vi.fn().mockResolvedValue(undefined),
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
  sendOrderReadyEmailToClient,
} from "@/lib/emails/order-events";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  refundPaymentIntent,
} from "@/lib/stripe-payments";

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

function orderChain(status: string, pickupAt?: Date) {
  const limit = vi.fn().mockResolvedValue([
    {
      id: ORDER_ID,
      cookId: COOK_ID,
      status,
      pickupAt: pickupAt ?? new Date(Date.now() + 2 * 3600_000),
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

/** Returns a select chain for the cookProfiles userId lookup on cancel. */
function cookUserChain(userId: string | null = COOK_USER_ID) {
  const limit = vi.fn().mockResolvedValue(userId ? [{ userId }] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/**
 * Returns a select chain for the fire-and-forget email lookup, which joins
 * orders + user + listings + cook_profiles (three innerJoins).
 */
function emailLookupChain() {
  const limit = vi.fn().mockResolvedValue([
    {
      clientEmail: "client@test.com",
      clientFirstName: "Client",
      listingTitle: "Test Listing",
      quantity: 2,
      totalPrice: "40.00",
      currency: "CAD",
      pickupAt: new Date(Date.now() + 2 * 3600_000),
      cookName: "Cook Kitchen",
    },
  ]);
  const where = vi.fn(() => ({ limit }));
  const innerJoin3 = vi.fn(() => ({ where }));
  const innerJoin2 = vi.fn(() => ({ innerJoin: innerJoin3 }));
  const innerJoin1 = vi.fn(() => ({ innerJoin: innerJoin2 }));
  const from = vi.fn(() => ({ innerJoin: innerJoin1 }));
  return { from } as never;
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
 * 2. order fetch (no payment queries needed)
 */
function withOrderForReady(pickupAt?: Date) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    call++;
    if (call === 1) return mockCook(true);
    if (call === 2) return orderChain("confirmed", pickupAt);
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

  it("sets expiry to at least 24h from now when transitioning to ready", async () => {
    const pickupAt = new Date(Date.now() - 2 * 3600_000); // pickup was 2h ago
    withOrderForReady(pickupAt);
    const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
    const before = new Date(Date.now() + 24 * 3600_000 - 1000);
    await PATCH(makePatch({ status: "ready" }), { params });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        pickupCodeExpiresAt: expect.any(Date),
      }),
    );
    const callArgs = (set as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    const expiry = callArgs.pickupCodeExpiresAt as Date;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(expiry.getTime()).toBeLessThan(before.getTime() + 25 * 3_600_000);
  });

  it("sets expiry to 6h after pickupAt when that is later than 24h from now", async () => {
    const pickupAt = new Date(Date.now() + 30 * 3600_000); // pickup 30h from now
    withOrderForReady(pickupAt);
    const { set } = mockUpdate({ id: ORDER_ID, status: "ready" });
    await PATCH(makePatch({ status: "ready" }), { params });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        pickupCodeExpiresAt: expect.any(Date),
      }),
    );
    const callArgs = (set as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    const expiry = callArgs.pickupCodeExpiresAt as Date;
    const expectedExpiry = new Date(pickupAt.getTime() + 6 * 3600_000);
    expect(expiry.getTime()).toBeCloseTo(expectedExpiry.getTime(), -3);
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
