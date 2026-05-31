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
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/business/dashboard/orders/[orderId]/status/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const ORDER_ID = "11111111-1111-4111-8111-111111111111";

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

function orderChain(status: string) {
  const limit = vi
    .fn()
    .mockResolvedValue([{ id: ORDER_ID, cookId: COOK_ID, status }]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function mockUpdate(row: object) {
  const returning = vi.fn().mockResolvedValue([row]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
  return { set };
}

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

  it("allows pending -> confirmed", async () => {
    withOrder("pending");
    mockUpdate({ id: ORDER_ID, status: "confirmed" });
    const res = await PATCH(makePatch({ status: "confirmed" }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("confirmed");
  });

  it("sets cancelledAt when cancelling", async () => {
    withOrder("pending");
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

function orderChainEmpty() {
  const limit = vi.fn().mockResolvedValue([]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}
