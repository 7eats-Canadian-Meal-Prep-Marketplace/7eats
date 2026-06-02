import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cancelPiMock, refundPiMock, partialCaptureMock } = vi.hoisted(() => ({
  cancelPiMock: vi.fn(),
  refundPiMock: vi.fn().mockResolvedValue("re_test"),
  partialCaptureMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  orderPayments: {},
  orders: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));

vi.mock("@/lib/stripe-payments", () => ({
  cancelPaymentIntent: cancelPiMock,
  refundPaymentIntent: refundPiMock,
  partialCapturePaymentIntent: partialCaptureMock,
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/orders/[orderId]/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

function makeRequest(orderId: string) {
  return new NextRequest(`http://localhost/api/orders/${orderId}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
  });
}

function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi
    .fn()
    .mockImplementation(() => Object.assign(Promise.resolve(rows), { limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function updateChain() {
  const where = vi.fn().mockResolvedValue([{}]);
  const set = vi.fn(() => ({ where }));
  return { set } as never;
}

// Using a valid v4 UUID (version nibble = 4, variant nibble = 8-b)
const ORDER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c410";

const PENDING_ORDER = {
  id: ORDER_ID,
  clientId: "user-1",
  status: "pending",
  totalPrice: "20.00",
  pickupAt: new Date(Date.now() + 86400000),
  lateCancelFeeEnabled: false,
  lateCancelFeeType: null,
  lateCancelFeeValue: null,
  lateCancelWindowHours: 24,
  depositAmount: null,
};

const CONFIRMED_ORDER = {
  ...PENDING_ORDER,
  status: "confirmed",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", role: "client", email: "c@t.com" },
  } as never);
  vi.mocked(db.update).mockReturnValue(updateChain());
});

afterEach(() => vi.unstubAllEnvs());

describe("DELETE /api/orders/[orderId]", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await DELETE(makeRequest(ORDER_ID), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when order not found", async () => {
    vi.mocked(db.select).mockImplementation(() => limitChain([]));
    const res = await DELETE(makeRequest(ORDER_ID), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("cancels PI and returns 200 for a pending order", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([PENDING_ORDER]);
      return limitChain([
        {
          id: "pay-1",
          type: "full",
          status: "authorized",
          stripePaymentIntentId: "pi_1",
          totalAmount: "20.00",
          platformFeePct: "7.50",
        },
      ]);
    });

    const res = await DELETE(makeRequest(ORDER_ID), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(200);
    expect(cancelPiMock).toHaveBeenCalledWith("pi_1", expect.any(String));
  });

  it("returns 400 for a fulfilled order", async () => {
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ ...PENDING_ORDER, status: "fulfilled" }]),
    );
    const res = await DELETE(makeRequest(ORDER_ID), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("partially captures late cancel fee on balance PI when within window", async () => {
    const pickupSoon = new Date(Date.now() + 2 * 3600 * 1000); // 2 hours from now
    const orderWithFee = {
      ...CONFIRMED_ORDER,
      pickupAt: pickupSoon,
      lateCancelFeeEnabled: true,
      lateCancelFeeType: "flat",
      lateCancelFeeValue: "5.00",
      lateCancelWindowHours: 24,
      depositAmount: null,
    };
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([orderWithFee]);
      return limitChain([
        {
          id: "pay-1",
          type: "full",
          status: "authorized",
          stripePaymentIntentId: "pi_1",
          totalAmount: "20.00",
          platformFeePct: "7.50",
        },
      ]);
    });

    const res = await DELETE(makeRequest(ORDER_ID), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(200);
    expect(partialCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({ captureAmountCents: 500 }),
    );
  });
});
