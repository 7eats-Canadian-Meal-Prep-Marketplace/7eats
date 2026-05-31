import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureMock } = vi.hoisted(() => ({ captureMock: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  orders: {},
  orderPayments: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));
vi.mock("stripe", () => ({
  default: class {
    paymentIntents = { capture: captureMock };
  },
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/business/dashboard/orders/[orderId]/verify-code/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const ORDER_ID = "11111111-1111-4111-8111-111111111111";

const params = Promise.resolve({ orderId: ORDER_ID });
const hashOf = (code: string) =>
  createHash("sha256").update(code).digest("hex");

function makePost(body: unknown, orderId = ORDER_ID): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/dashboard/orders/${orderId}/verify-code`,
    {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    },
  );
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId } } as never) : null,
  );
}

// callCount 1 = getCookId cookProfiles lookup
function mockCook(found: boolean) {
  const limit = vi.fn().mockResolvedValue(found ? [{ id: COOK_ID }] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function selectChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function mockUpdate(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
  return { set, where, returning };
}

const readyOrder = {
  id: ORDER_ID,
  cookId: COOK_ID,
  status: "ready",
  pickupCodeHash: hashOf("1234"),
  pickupCodeExpiresAt: new Date(Date.now() + 3_600_000),
  pickupCodeAttempts: 0,
};

describe("POST /api/business/dashboard/orders/[orderId]/verify-code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession(USER_ID);
  });

  it("returns 401 when there is no cook profile", async () => {
    mockSession(null);
    const res = await POST(makePost({ code: "1234" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-uuid order ID", async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockCook(true));
    const res = await POST(makePost({ code: "1234" }, "not-a-uuid"), {
      params: Promise.resolve({ orderId: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockCook(true));
    const res = await POST(makePost("not-json"), { params });
    expect(res.status).toBe(400);
  });

  it("returns 400 when code is missing", async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockCook(true));
    const res = await POST(makePost({}), { params });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the order does not belong to the cook", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      return call === 1 ? mockCook(true) : selectChain([]);
    });
    const res = await POST(makePost({ code: "1234" }), { params });
    expect(res.status).toBe(404);
  });

  it("returns 400 when the order is not ready for pickup", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      return call === 1
        ? mockCook(true)
        : selectChain([{ ...readyOrder, status: "confirmed" }]);
    });
    const res = await POST(makePost({ code: "1234" }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Order is not ready for pickup.");
  });

  it("returns 429 after MAX_ATTEMPTS exceeded", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      return call === 1
        ? mockCook(true)
        : selectChain([{ ...readyOrder, pickupCodeAttempts: 5 }]);
    });
    const res = await POST(makePost({ code: "1234" }), { params });
    expect(res.status).toBe(429);
  });

  it("returns 400 when the pickup code has expired", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      return call === 1
        ? mockCook(true)
        : selectChain([
            {
              ...readyOrder,
              pickupCodeExpiresAt: new Date(Date.now() - 1_000),
            },
          ]);
    });
    const res = await POST(makePost({ code: "1234" }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Pickup code has expired.");
  });

  it("increments attempts and returns attemptsRemaining on a wrong code", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      return call === 1 ? mockCook(true) : selectChain([readyOrder]);
    });
    const { set } = mockUpdate([{ pickupCodeAttempts: 1 }]);

    const res = await POST(makePost({ code: "9999" }), { params });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid code.");
    expect(body.attemptsRemaining).toBe(4);
    expect(set).toHaveBeenCalledTimes(1); // only the attempts bump, no fulfilment
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("fulfils the order, captures payment, and releases funds on the correct code", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return mockCook(true);
      if (call === 2) return selectChain([readyOrder]);
      // orderPayments lookup
      return selectChain([{ stripePaymentIntentId: "pi_123" }]);
    });
    mockUpdate([{ id: ORDER_ID, fulfilledAt: new Date() }]);

    const res = await POST(makePost({ code: "1234" }), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.orderId).toBe(ORDER_ID);
    expect(captureMock).toHaveBeenCalledWith("pi_123");

    vi.unstubAllEnvs();
  });

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
    const res = await POST(makePost({ code: "1234" }), { params });
    expect(res.status).toBe(500);
  });
});
