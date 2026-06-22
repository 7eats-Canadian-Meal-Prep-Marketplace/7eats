import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancelPiMock, refundPiMock, captureMock } = vi.hoisted(() => ({
  cancelPiMock: vi.fn().mockResolvedValue(undefined),
  refundPiMock: vi.fn().mockResolvedValue("re_test"),
  captureMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  orderPayments: {},
  orders: {},
  authUser: {},
  cookProfiles: {},
  orderDishes: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));

vi.mock("@/lib/stripe-payments", () => ({
  cancelPaymentIntent: cancelPiMock,
  refundPaymentIntent: refundPiMock,
  capturePaymentIntent: captureMock,
}));
vi.mock("@/lib/order-pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/order-pricing")>();
  return { ...actual };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/emails/order-events", () => ({
  sendOrderCancelledByClientEmailToCook: vi.fn().mockResolvedValue(undefined),
  sendOrderCancelledByClientEmailToClient: vi.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/orders/[orderId]/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const ORDER_ID = "c3d4e5f6-a7b8-4c9d-8e1f-a2b3c4d5e6f7";

function makeRequest() {
  return new NextRequest(`http://localhost/api/orders/${ORDER_ID}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
  });
}

/** Query-shape-agnostic chain resolving to `rows` when awaited. */
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
  let i = 0;
  return () => chain(results[i++] ?? []);
}

function updateChain() {
  return chain([{}]);
}

const FUTURE = new Date(Date.now() + 7 * 86400_000);

function orderRow(over: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    clientId: "user-1",
    cookId: "cook-1",
    status: "pending",
    totalPrice: "30.00",
    currency: "CAD",
    pickupAt: FUTURE,
    cancellationAllowed: true,
    cookLeadTime: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", role: "client", email: "c@t.com" },
  } as never);
  vi.mocked(db.update).mockReturnValue(updateChain());
});

describe("DELETE /api/orders/[orderId]", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("404 when order not found", async () => {
    vi.mocked(db.select).mockImplementation(selectQueue([[]]));
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("400 for a fulfilled order", async () => {
    vi.mocked(db.select).mockImplementation(
      selectQueue([[orderRow({ status: "fulfilled" })]]),
    );
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("refunds (cancels PI) when cancellation is allowed and within window", async () => {
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [orderRow()],
        [{ id: "p1", status: "authorized", stripePaymentIntentId: "pi_1" }],
        [
          {
            cookEmail: "k@t.com",
            cookFirstName: "K",
            cookDisplayName: "Kitchen",
          },
        ],
        [{ firstName: "C", lastName: "D", email: "c@t.com" }],
        [{ dishName: "Soup", quantity: 1 }],
      ]),
    );

    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.refunded).toBe(true);
    expect(cancelPiMock).toHaveBeenCalledOnce();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("captures (no refund) when cancellation is not allowed", async () => {
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [orderRow({ cancellationAllowed: false })],
        [{ id: "p1", status: "authorized", stripePaymentIntentId: "pi_1" }],
        [
          {
            cookEmail: "k@t.com",
            cookFirstName: "K",
            cookDisplayName: "Kitchen",
          },
        ],
        [{ firstName: "C", lastName: "D", email: "c@t.com" }],
        [{ dishName: "Soup", quantity: 1 }],
      ]),
    );

    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.refunded).toBe(false);
    expect(captureMock).toHaveBeenCalledOnce();
    expect(cancelPiMock).not.toHaveBeenCalled();
  });
});
