import { beforeEach, describe, expect, it, vi } from "vitest";

const { retrieveMock } = vi.hoisted(() => ({ retrieveMock: vi.fn() }));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
  orderDishes: {},
  orderPayments: {},
  orders: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ paymentIntents: { retrieve: retrieveMock } }),
}));
vi.mock("@/lib/emails/order-events", () => ({
  sendGuestOrderReceiptToClient: vi.fn().mockResolvedValue(undefined),
  sendOrderPlacedEmailToCook: vi.fn().mockResolvedValue(undefined),
  sendOrderReceiptToClient: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/cooks/order-notifications", () => ({
  sendCookNewOrderSms: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/guest/order-access", () => ({
  guestAccessTokensMatch: vi.fn(),
}));

import { db } from "@/db";
import { sendCookNewOrderSms } from "@/lib/cooks/order-notifications";
import { markOrderPaymentAuthorized } from "@/lib/orders/confirm-order-payment";

const PI_ID = "pi_test_sms";

function mockSelectPendingAndOrder() {
  let selectCall = 0;
  vi.mocked(db.select).mockImplementation(() => {
    selectCall += 1;
    if (selectCall === 1) {
      const limit = vi
        .fn()
        .mockResolvedValue([
          { id: "pay-1", orderId: "order-1", status: "pending" },
        ]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    }
    if (selectCall === 2) {
      const limit = vi.fn().mockResolvedValue([
        {
          id: "order-1",
          totalPrice: "45.00",
          currency: "CAD",
          deliveryFeeSnapshot: null,
          taxAmount: "0.00",
          pickupAt: null,
          fulfillmentMode: "pickup",
          fulfillmentWindowStart: null,
          fulfillmentWindowEnd: null,
          cancellationAllowed: false,
          isGuestCheckout: false,
          confirmationCode: null,
          clientId: "client-1",
          cookId: "cook-1",
        },
      ]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    }
    if (selectCall === 3) {
      const where = vi.fn().mockResolvedValue([
        {
          dishName: "Butter chicken",
          quantity: 2,
          lineTotal: "45.00",
          discountAmount: "0.00",
          sortOrder: 0,
        },
      ]);
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    }
    if (selectCall === 4) {
      const limit = vi.fn().mockResolvedValue([
        {
          email: "client@example.com",
          firstName: "Jane",
          lastName: "Doe",
          phone: null,
          phoneVerified: false,
          notificationPreferences: null,
        },
      ]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    }
    const limit = vi.fn().mockResolvedValue([
      {
        displayName: "Hendrik's Kitchen",
        cookEmail: "cook@example.com",
        cookFirstName: "Hendrik",
        cookPhone: "+15559876543",
        cookPhoneVerified: true,
        emailNotificationsNewOrder: true,
        smsNotificationsNewOrder: true,
      },
    ]);
    const where = vi.fn(() => ({ limit }));
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    return { from } as never;
  });
}

function mockUpdate() {
  const returning = vi.fn().mockResolvedValue([{ id: "pay-1" }]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
}

describe("markOrderPaymentAuthorized — cook new-order SMS", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fires cook SMS when payment is authorized", async () => {
    mockSelectPendingAndOrder();
    mockUpdate();
    retrieveMock.mockResolvedValue({
      status: "requires_capture",
      latest_charge: "ch_abc",
    });

    await markOrderPaymentAuthorized(PI_ID);

    expect(sendCookNewOrderSms).toHaveBeenCalledWith(
      {
        phone: "+15559876543",
        phoneVerified: true,
        smsNotificationsNewOrder: true,
      },
      "Jane Doe",
      "Butter chicken",
    );
  });
});
