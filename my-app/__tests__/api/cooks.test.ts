import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
  cookProfileTags: {},
  cookPickupWindows: {},
  dishes: { id: "id", cookId: "cookId", status: "status" },
  tags: {},
  reviews: {},
  orders: {},
  orderDishes: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  inArray: vi.fn(),
  exists: vi.fn(),
  avg: vi.fn().mockReturnValue({}),
  count: vi.fn().mockReturnValue({}),
  sql: Object.assign(vi.fn().mockReturnValue({}), {
    join: vi.fn().mockReturnValue({}),
  }),
}));

import { NextRequest } from "next/server";
import { GET as getCookReviews } from "@/app/api/cooks/[cookId]/reviews/route";
import { GET as getCookById } from "@/app/api/cooks/[cookId]/route";
import { GET as getCooks } from "@/app/api/cooks/route";
import { db } from "@/db";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

const COOK_ID = "b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6";

/**
 * A query-shape-agnostic Drizzle mock: every chained method returns the same
 * proxy, and awaiting it resolves to `rows`. This keeps the tests focused on
 * behavior (status, response shape) instead of exact builder call sequences.
 */
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

/** Queue distinct result sets for each successive db.select() call. */
function selectQueue(results: unknown[][]) {
  let i = 0;
  return () => chain(results[i++] ?? []);
}

const MOCK_COOK_ROW = {
  id: COOK_ID,
  displayName: "Mama Olu's Kitchen",
  firstName: "Maria",
  lastName: "Garcia",
  photoUrl: null,
  bio: "Home-cooked West African meals",
  leadTime: "1_day",
  delivery: "self",
  offersPickup: true,
  pickupCity: "Toronto",
  avgRating: "4.5",
  reviewCount: "3",
  representativeDishPhoto: null,
  distanceKm: null,
};

const MOCK_COOK_DETAIL = {
  id: COOK_ID,
  userId: "user-uuid",
  displayName: "Mama Olu's Kitchen",
  firstName: "Maria",
  lastName: "Garcia",
  bio: "I love cooking!",
  neighborhood: "Little Italy",
  leadTime: "1_day",
  minOrderQty: 1,
  maxOrderQty: null,
  cancellationAllowed: false,
  isVerified: true,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
};

// ─── GET /api/cooks ───────────────────────────────────────────────────────────

describe("GET /api/cooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with array of cook cards", async () => {
    // candidate-id select, the exists() sub-select, then loadCookCards:
    // base rows, tag rows, window rows, fulfilled-order rows
    vi.mocked(db.select).mockImplementation(
      selectQueue([[{ id: COOK_ID }], [], [MOCK_COOK_ROW], [], [], []]),
    );

    const res = await getCooks(makeReq("http://localhost/api/cooks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].id).toBe(COOK_ID);
    expect(body.data[0].displayName).toBe("Mama Olu's Kitchen");
    expect(body.data[0].cookName).toBe("Maria Garcia");
  });

  it("returns 200 with empty array when no cooks", async () => {
    vi.mocked(db.select).mockImplementation(selectQueue([[], [], [], []]));

    const res = await getCooks(makeReq("http://localhost/api/cooks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("returns 500 on db error", async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("db error");
    });

    const res = await getCooks(makeReq("http://localhost/api/cooks"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ─── GET /api/cooks/[cookId] ──────────────────────────────────────────────────

describe("GET /api/cooks/[cookId]", () => {
  beforeEach(() => vi.clearAllMocks());

  const ctx = { params: Promise.resolve({ cookId: COOK_ID }) };

  it("returns 200 with cook data when found", async () => {
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [MOCK_COOK_DETAIL],
        [{ ordersCompleted: 5 }],
        [{ avgRating: "4.5", reviewCount: 3 }],
      ]),
    );

    const res = await getCookById(
      makeReq(`http://localhost/api/cooks/${COOK_ID}`),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(COOK_ID);
    expect(body.data.name).toBe("Maria Garcia");
    expect(body.data.minOrderQty).toBe(1);
    expect(body.data.cancellationAllowed).toBe(false);
  });

  it("returns 404 when cook not found", async () => {
    vi.mocked(db.select).mockImplementation(selectQueue([[]]));

    const res = await getCookById(
      makeReq(`http://localhost/api/cooks/${COOK_ID}`),
      ctx,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 500 on db error", async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("db error");
    });

    const res = await getCookById(
      makeReq(`http://localhost/api/cooks/${COOK_ID}`),
      ctx,
    );
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/cooks/[cookId]/reviews ──────────────────────────────────────────

describe("GET /api/cooks/[cookId]/reviews", () => {
  beforeEach(() => vi.clearAllMocks());

  const ctx = { params: Promise.resolve({ cookId: COOK_ID }) };

  it("returns 200 with reviews (dish names attached) when cook exists", async () => {
    const mockReview = {
      id: "review-1",
      orderId: "order-1",
      rating: 5,
      comment: "Excellent!",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      reviewerFirstName: "Alice",
      reviewerLastName: "Smith",
    };
    // cook lookup, count, review rows, order_dishes
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [{ id: COOK_ID }],
        [{ total: 1 }],
        [mockReview],
        [{ orderId: "order-1", name: "Jollof Rice" }],
      ]),
    );

    const res = await getCookReviews(
      makeReq(`http://localhost/api/cooks/${COOK_ID}/reviews`),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].reviewerName).toBe("Alice S.");
    expect(body.data[0].dishes).toEqual(["Jollof Rice"]);
    expect(body.meta.total).toBe(1);
  });

  it("returns 404 when cook not found", async () => {
    vi.mocked(db.select).mockImplementation(selectQueue([[]]));

    const res = await getCookReviews(
      makeReq(`http://localhost/api/cooks/${COOK_ID}/reviews`),
      ctx,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 with empty reviews when none exist", async () => {
    vi.mocked(db.select).mockImplementation(
      selectQueue([[{ id: COOK_ID }], [{ total: 0 }], []]),
    );

    const res = await getCookReviews(
      makeReq(`http://localhost/api/cooks/${COOK_ID}/reviews`),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("returns 500 on db error", async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("db error");
    });

    const res = await getCookReviews(
      makeReq(`http://localhost/api/cooks/${COOK_ID}/reviews`),
      ctx,
    );
    expect(res.status).toBe(500);
  });
});
