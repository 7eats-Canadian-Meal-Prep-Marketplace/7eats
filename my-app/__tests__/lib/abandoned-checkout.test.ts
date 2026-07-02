import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancelPiMock } = vi.hoisted(() => ({
  cancelPiMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/db/schema", () => ({
  dishPromotions: { id: "id", usesCount: "usesCount" },
  orderDishes: { orderId: "orderId", promotionId: "promotionId" },
  orderPayments: {
    id: "id",
    orderId: "orderId",
    type: "type",
    status: "status",
    stripePaymentIntentId: "stripePaymentIntentId",
  },
  orders: {
    id: "id",
    status: "status",
    createdAt: "createdAt",
    cancelledAt: "cancelledAt",
    cancelledBy: "cancelledBy",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a, b) => ({ a, b })),
  exists: vi.fn((subquery: unknown) => ({ exists: subquery })),
  lt: vi.fn((a, b) => ({ lt: a, b })),
  ne: vi.fn((a, b) => ({ ne: a, b })),
  sql: vi.fn((strings: TemplateStringsArray) => strings.join("")),
}));

vi.mock("@/lib/stripe/payments", () => ({
  cancelPaymentIntent: cancelPiMock,
}));

import { db } from "@/db";
import {
  ABANDONED_CHECKOUT_TTL_MS,
  cancelAbandonedCheckoutOrder,
  isOrderPaymentPlaced,
  isUnpaidCheckoutPayment,
  orderHasPlacedPaymentFilter,
  platformDiscountRedemptionFilter,
} from "@/lib/orders/abandoned-checkout";

function selectChain(final: unknown) {
  const limit = vi.fn().mockResolvedValue(final);
  const where = vi.fn().mockReturnValue({ limit });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin, where });
  return { from };
}

function selectWhereResolveChain(final: unknown) {
  const where = vi.fn().mockResolvedValue(final);
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

function updateChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  return { set };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("abandoned-checkout helpers", () => {
  it("treats pending as unpaid and authorized as placed", () => {
    expect(isUnpaidCheckoutPayment("pending")).toBe(true);
    expect(isOrderPaymentPlaced("pending")).toBe(false);
    expect(isOrderPaymentPlaced("authorized")).toBe(true);
    expect(isOrderPaymentPlaced("refunded")).toBe(true);
  });

  it("builds a placed-payment EXISTS filter", () => {
    const filter = orderHasPlacedPaymentFilter();
    expect(String(filter)).toContain("EXISTS");
  });

  it("builds a platform discount redemption filter", () => {
    const filter = platformDiscountRedemptionFilter();
    expect(String(filter)).toBeTruthy();
  });

  it("uses a 30-minute checkout TTL", () => {
    expect(ABANDONED_CHECKOUT_TTL_MS).toBe(30 * 60 * 1000);
  });
});

describe("cancelAbandonedCheckoutOrder", () => {
  it("cancels Stripe PI and marks order cancelled for pending payment", async () => {
    let selectCall = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return selectChain([
          {
            orderId: "order-1",
            orderStatus: "pending",
            paymentId: "pay-1",
            paymentStatus: "pending",
            stripePaymentIntentId: "pi_123",
          },
        ]) as never;
      }
      return selectWhereResolveChain([{ promotionId: null }]) as never;
    });
    vi.mocked(db.update).mockImplementation(() => updateChain() as never);

    const result = await cancelAbandonedCheckoutOrder("order-1");

    expect(result).toEqual({ ok: true, cancelled: true, orderId: "order-1" });
    expect(cancelPiMock).toHaveBeenCalledWith("pi_123", "abandon-order-1");
    const setMock = vi.mocked(db.update).mock.results.at(-1)?.value.set;
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        platformDiscountId: null,
        platformDiscountAmount: null,
      }),
    );
  });

  it("is idempotent when the order is already cancelled", async () => {
    vi.mocked(db.select).mockImplementation(
      () =>
        selectChain([
          {
            orderId: "order-1",
            orderStatus: "cancelled",
            paymentId: "pay-1",
            paymentStatus: "pending",
            stripePaymentIntentId: "pi_123",
          },
        ]) as never,
    );

    const result = await cancelAbandonedCheckoutOrder("order-1");

    expect(result).toEqual({ ok: true, cancelled: false, orderId: "order-1" });
    expect(cancelPiMock).not.toHaveBeenCalled();
  });

  it("refuses when payment is already authorized", async () => {
    vi.mocked(db.select).mockImplementation(
      () =>
        selectChain([
          {
            orderId: "order-1",
            orderStatus: "pending",
            paymentId: "pay-1",
            paymentStatus: "authorized",
            stripePaymentIntentId: "pi_123",
          },
        ]) as never,
    );

    const result = await cancelAbandonedCheckoutOrder("order-1");

    expect(result).toEqual({
      ok: false,
      orderId: "order-1",
      reason: "payment_not_pending",
    });
  });
});
