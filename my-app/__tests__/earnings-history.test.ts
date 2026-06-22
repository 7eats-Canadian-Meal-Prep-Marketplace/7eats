import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  cookProfiles: {},
  orders: {},
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/business/dashboard/earnings/history/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";

function makeGet(query = "period=week&count=8"): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/dashboard/earnings/history?${query}`,
  );
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "cook" } } as never) : null,
  );
}

/** getCookId chain: select().from().where().limit() */
function cookChain() {
  const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** orders aggregation chain: select().from().where() resolves to rows */
function ordersChain(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

describe("GET /api/business/dashboard/earnings/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession(USER_ID);
  });

  it("returns 401 when there is no cook", async () => {
    mockSession(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("buckets fulfilled-order revenue by fulfilledAt and totals it", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return cookChain();
      // A just-fulfilled order lands in the most recent weekly bucket; a row
      // with no fulfilledAt must be ignored entirely.
      return ordersChain([
        { fulfilledAt: new Date(), totalPrice: "40.00" },
        { fulfilledAt: null, totalPrice: "99.00" },
      ]);
    });

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(40);
    // Most recent bucket (last entry) holds the just-fulfilled order.
    const series = body.data.series as { value: number }[];
    expect(series[series.length - 1].value).toBe(40);
  });

  it("returns an all-zero series when there are no fulfilled orders", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      return call === 1 ? cookChain() : ordersChain([]);
    });

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.total).toBe(0);
    expect(body.data.series).toHaveLength(8);
  });
});
