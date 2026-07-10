import { beforeEach, describe, expect, it, vi } from "vitest";

const { retrieveMock } = vi.hoisted(() => ({ retrieveMock: vi.fn() }));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
  dbPool: { transaction: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
  orderDishes: {},
  orderPayments: {},
  orders: {},
}));
vi.mock("@/lib/orders/platform-discount-repo", () => ({
  commitPendingPlatformDiscount: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ paymentIntents: { retrieve: retrieveMock } }),
}));
vi.mock("@/lib/emails/order-events", () => ({
  sendGuestOrderReceiptToClient: vi.fn(),
  sendOrderPlacedEmailToCook: vi.fn(),
  sendOrderReceiptToClient: vi.fn(),
}));
vi.mock("@/lib/guest/order-access", () => ({
  guestAccessTokensMatch: vi.fn(),
}));

import { db, dbPool } from "@/db";
import { markOrderPaymentAuthorized } from "@/lib/orders/confirm-order-payment";

const PI_ID = "pi_test_123";

function mockSelectPending() {
  const limit = vi
    .fn()
    .mockResolvedValue([
      { id: "pay-1", orderId: "order-1", status: "pending" },
    ]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

function mockUpdate() {
  const returning = vi.fn().mockResolvedValue([{ id: "pay-1" }]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  vi.mocked(dbPool.transaction).mockImplementation(async (fn) =>
    fn({ update } as never),
  );
  return { set };
}

describe("markOrderPaymentAuthorized — persists the authorization charge id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores latest_charge when it is a string id", async () => {
    mockSelectPending();
    const { set } = mockUpdate();
    retrieveMock.mockResolvedValue({
      status: "requires_capture",
      latest_charge: "ch_abc",
    });

    await markOrderPaymentAuthorized(PI_ID, { sendEmails: false });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "authorized",
        stripeChargeId: "ch_abc",
      }),
    );
  });

  it("stores latest_charge.id when it is an expanded object", async () => {
    mockSelectPending();
    const { set } = mockUpdate();
    retrieveMock.mockResolvedValue({
      status: "requires_capture",
      latest_charge: { id: "ch_obj" },
    });

    await markOrderPaymentAuthorized(PI_ID, { sendEmails: false });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ stripeChargeId: "ch_obj" }),
    );
  });

  it("stores null when there is no charge yet", async () => {
    mockSelectPending();
    const { set } = mockUpdate();
    retrieveMock.mockResolvedValue({
      status: "requires_capture",
      latest_charge: null,
    });

    await markOrderPaymentAuthorized(PI_ID, { sendEmails: false });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ stripeChargeId: null }),
    );
  });
});
