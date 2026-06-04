import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  dbPool: { transaction: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
  dishes: {},
  listingDishes: {},
  listingPromotions: {},
  listings: {},
  orderDishes: {},
  orderPayments: {},
  orders: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  count: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("@/lib/stripe-payments", () => ({
  createFullPaymentIntent: vi.fn(),
  cancelPaymentIntent: vi.fn(),
}));

vi.mock("@/lib/stripe-subscriptions", () => ({
  getOrCreateStripeCustomer: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/orders/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

function makeRequest(url: string) {
  return new NextRequest(url, { method: "GET" });
}

const ORDER_ID = "c3d4e5f6-a7b8-4c9d-0e1f-a2b3c4d5e6f7";
const LISTING_TITLE = "Homemade Lasagna";

const MOCK_ORDER = {
  id: ORDER_ID,
  status: "pending" as const,
  listingTitle: LISTING_TITLE,
  quantity: 2,
  unitPrice: "15.00",
  totalPrice: "30.00",
  currency: "CAD",
  pickupAt: new Date("2026-06-10T12:00:00.000Z"),
  notes: null,
  createdAt: new Date("2026-06-02T09:00:00.000Z"),
  pickupCode: null,
};

const MOCK_DISH = {
  orderId: ORDER_ID,
  id: "dish-uuid-1",
  dishName: "Lasagna",
  quantity: 2,
  sortOrder: 0,
};

// Chain for count query: db.select({total}).from(...).where(...) => resolves directly
function buildCountChain(total: number) {
  const whereFn = vi.fn().mockResolvedValue([{ total }]);
  const fromFn = vi.fn(() => ({ where: whereFn }));
  return { from: fromFn } as never;
}

// Chain for data query: db.select({...}).from(...).leftJoin(...).where(...).orderBy(...).limit(...).offset(...) => resolves
function buildDataChain(finalValue: unknown) {
  const offsetFn = vi.fn().mockResolvedValue(finalValue);
  const limitFn = vi.fn(() => ({ offset: offsetFn }));
  const orderByFn = vi.fn(() => ({ limit: limitFn }));
  const whereFn = vi.fn(() => ({ orderBy: orderByFn }));
  const leftJoinFn = vi.fn(() => ({ where: whereFn }));
  const fromFn = vi.fn(() => ({ leftJoin: leftJoinFn }));
  return { from: fromFn } as never;
}

// Chain for dishes query: db.select({...}).from(...).where(...) => resolves directly
function buildWhereResolveChain(finalValue: unknown) {
  const whereFn = vi.fn().mockResolvedValue(finalValue);
  const fromFn = vi.fn(() => ({ where: whereFn }));
  return { from: fromFn } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", role: "client", email: "client@test.com" },
  } as never);
});

describe("GET /api/orders", () => {
  it("returns 401 when no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/orders"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 403 when role is cook", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "cook", email: "cook@test.com" },
    } as never);
    const res = await GET(makeRequest("http://localhost/api/orders"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 with empty data when no orders", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return buildCountChain(0);
      if (call === 2) return buildDataChain([]);
      return buildWhereResolveChain([]);
    });

    const res = await GET(makeRequest("http://localhost/api/orders"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it("returns 200 with orders list (1 order, 1 dish)", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return buildCountChain(1);
      if (call === 2) return buildDataChain([MOCK_ORDER]);
      return buildWhereResolveChain([MOCK_DISH]);
    });

    const res = await GET(makeRequest("http://localhost/api/orders"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    const order = body.data[0];
    expect(order.id).toBe(ORDER_ID);
    expect(order.listingTitle).toBe(LISTING_TITLE);
    expect(order.quantity).toBe(2);
    expect(order.dishes).toHaveLength(1);
    expect(order.dishes[0].dishName).toBe("Lasagna");
    expect(body.meta).toEqual({ total: 1, limit: 20, offset: 0 });
  });

  it("clamps limit to 100 when ?limit=9999", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return buildCountChain(0);
      if (call === 2) return buildDataChain([]);
      return buildWhereResolveChain([]);
    });

    const res = await GET(
      makeRequest("http://localhost/api/orders?limit=9999"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.limit).toBe(100);
  });

  it("defaults limit=20 and offset=0 when not provided", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return buildCountChain(0);
      if (call === 2) return buildDataChain([]);
      return buildWhereResolveChain([]);
    });

    const res = await GET(makeRequest("http://localhost/api/orders"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.limit).toBe(20);
    expect(body.meta.offset).toBe(0);
  });

  it("filters by status when ?status=fulfilled", async () => {
    let call = 0;
    const { and: andMock, eq: eqMock } = await import("drizzle-orm");

    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return buildCountChain(0);
      if (call === 2) return buildDataChain([]);
      return buildWhereResolveChain([]);
    });

    const res = await GET(
      makeRequest("http://localhost/api/orders?status=fulfilled"),
    );
    expect(res.status).toBe(200);
    // and() is called once when a status filter is applied (whereClause is built once,
    // then reused for both the count and data queries)
    expect(andMock).toHaveBeenCalledTimes(1);
    // and() receives two arguments: the clientId eq result and the status eq result
    expect(vi.mocked(andMock).mock.calls[0]).toHaveLength(2);
    // eq() must have been called with the status value "fulfilled" as its second argument.
    // Schema fields are mocked as {} so property accesses (orders.status etc.) resolve to
    // undefined; we match on the literal "fulfilled" which is always a concrete string.
    const eqCalls = vi.mocked(eqMock).mock.calls;
    const statusEqCall = eqCalls.find((args) => args[1] === "fulfilled");
    expect(statusEqCall).toBeDefined();
  });

  it("returns pickupCode for ready orders, null for other statuses", async () => {
    const readyOrder = {
      ...MOCK_ORDER,
      status: "ready" as const,
      pickupCode: "123456",
    };
    const pendingOrder = {
      ...MOCK_ORDER,
      id: "another-uuid-0000-0000-000000000001",
      status: "pending" as const,
      pickupCode: "654321",
    };

    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return buildCountChain(2);
      if (call === 2) return buildDataChain([readyOrder, pendingOrder]);
      return buildWhereResolveChain([]);
    });

    const res = await GET(makeRequest("http://localhost/api/orders"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const ready = body.data.find(
      (o: { status: string }) => o.status === "ready",
    );
    const pending = body.data.find(
      (o: { status: string }) => o.status === "pending",
    );
    expect(ready.pickupCode).toBe("123456");
    expect(pending.pickupCode).toBeNull();
  });
});
