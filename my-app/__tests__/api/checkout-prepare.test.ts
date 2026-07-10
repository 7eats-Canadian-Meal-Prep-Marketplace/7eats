import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancelClientPendingMock, getSessionMock, retrievePiMock } = vi.hoisted(
  () => ({
    cancelClientPendingMock: vi.fn(),
    getSessionMock: vi.fn(),
    retrievePiMock: vi.fn(),
  }),
);

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock("@/lib/orders/abandoned-checkout", () => ({
  cancelClientPendingCheckouts: cancelClientPendingMock,
  isUnpaidCheckoutPayment: (status: string) => status === "pending",
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    paymentIntents: { retrieve: retrievePiMock },
  }),
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  orderPayments: {
    orderId: "orderId",
    type: "type",
    status: "status",
    stripePaymentIntentId: "stripePaymentIntentId",
  },
  orders: {
    id: "id",
    clientId: "clientId",
    cookId: "cookId",
    status: "status",
    isGuestCheckout: "isGuestCheckout",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a, b) => ({ a, b })),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/checkout/prepare/route";
import { db } from "@/db";

const COOK_ID = "11111111-1111-4111-8111-111111111111";
const RESUME_ORDER_ID = "22222222-2222-4222-8222-222222222222";

function selectChain(final: unknown) {
  const limit = vi.fn().mockResolvedValue(final);
  const where = vi.fn().mockReturnValue({ limit });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });
  return { from };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({
    user: { id: "client-1", role: "client" },
  });
  cancelClientPendingMock.mockResolvedValue(["order-old"]);
  retrievePiMock.mockResolvedValue({
    client_secret: "pi_secret",
    status: "requires_payment_method",
  });
});

describe("POST /api/checkout/prepare", () => {
  it("releases stale checkouts and resumes a valid pending session", async () => {
    vi.mocked(db.select).mockImplementation(
      () =>
        selectChain([
          {
            orderId: RESUME_ORDER_ID,
            cookId: COOK_ID,
            orderStatus: "pending",
            paymentStatus: "pending",
            stripePaymentIntentId: "pi_123",
            isGuestCheckout: false,
          },
        ]) as never,
    );

    const req = new NextRequest("http://localhost/api/checkout/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cookId: COOK_ID,
        resumeOrderId: RESUME_ORDER_ID,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.resumed).toEqual({
      orderId: RESUME_ORDER_ID,
      clientSecret: "pi_secret",
      paymentIntentStatus: "requires_payment_method",
      isGuestCheckout: false,
    });
    expect(cancelClientPendingMock).toHaveBeenCalledWith("client-1", {
      exceptOrderId: RESUME_ORDER_ID,
    });
  });

  it("cancels all pending checkouts when nothing can be resumed", async () => {
    vi.mocked(db.select).mockImplementation(() => selectChain([]) as never);

    const req = new NextRequest("http://localhost/api/checkout/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cookId: COOK_ID }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.resumed).toBeNull();
    expect(cancelClientPendingMock).toHaveBeenCalledWith("client-1", {
      exceptOrderId: undefined,
    });
  });
});
