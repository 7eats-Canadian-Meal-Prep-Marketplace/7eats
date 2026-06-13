import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
  listings: {},
  reviews: {},
  orders: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  avg: vi.fn().mockReturnValue({}),
  count: vi.fn().mockReturnValue({}),
  sql: Object.assign(vi.fn().mockReturnValue({}), {
    join: vi.fn().mockReturnValue({}),
  }),
}));

import { NextRequest } from "next/server";
import { GET as getCookListings } from "@/app/api/cooks/[cookId]/listings/route";
import { GET as getCookReviews } from "@/app/api/cooks/[cookId]/reviews/route";
import { GET as getCookById } from "@/app/api/cooks/[cookId]/route";
import { GET as getCooks } from "@/app/api/cooks/route";
import { db } from "@/db";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

const COOK_ID = "b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6";

/** .from().leftJoin()...().where().groupBy().limit() */
function cooksListChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const groupBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ groupBy }));
  const leftJoin3 = vi.fn(() => ({ where }));
  const leftJoin2 = vi.fn(() => ({ leftJoin: leftJoin3 }));
  const leftJoin1 = vi.fn(() => ({ leftJoin: leftJoin2 }));
  const from = vi.fn(() => ({ leftJoin: leftJoin1 }));
  return { from } as never;
}

/** .from().innerJoin().where().limit() */
function innerJoinLimitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ innerJoin }));
  return { from } as never;
}

/** .from().where() resolves directly */
function whereChain(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** .from().where().limit() */
function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** .from().innerJoin().leftJoin().where().orderBy().limit().offset() */
function reviewsDataChain(rows: unknown[]) {
  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const leftJoin = vi.fn(() => ({ where }));
  const innerJoin = vi.fn(() => ({ leftJoin }));
  const from = vi.fn(() => ({ innerJoin }));
  return { from } as never;
}

const MOCK_COOK_ROW = {
  id: COOK_ID,
  firstName: "Maria",
  lastName: "G.",
  neighborhood: "Little Italy",
  avgRating: "4.5",
  reviewCount: "3",
  ordersCompleted: 10,
};

const MOCK_COOK_DETAIL = {
  id: COOK_ID,
  userId: "user-uuid",
  firstName: "Maria",
  lastName: "Garcia",
  bio: "I love cooking!",
  neighborhood: "Little Italy",
  leadTime: 24,
  isVerified: true,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
};

const MOCK_LISTING = {
  id: "listing-uuid",
  title: "Homemade Tamales",
  description: "Traditional tamales",
  type: "one_time",
  subscriptionEnabled: false,
  basePrice: "15.00",
  currency: "CAD",
  coverPhotoUrl: null,
  minOrderQty: 1,
  maxOrderQty: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

// ─── GET /api/cooks ───────────────────────────────────────────────────────────

describe("GET /api/cooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with array of cooks", async () => {
    vi.mocked(db.select).mockImplementation(() =>
      cooksListChain([MOCK_COOK_ROW]),
    );

    const res = await getCooks();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].id).toBe(COOK_ID);
  });

  it("returns 200 with empty array when no cooks", async () => {
    vi.mocked(db.select).mockImplementation(() => cooksListChain([]));

    const res = await getCooks();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("returns 500 on db error", async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("db error");
    });

    const res = await getCooks();
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
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return innerJoinLimitChain([MOCK_COOK_DETAIL]);
      if (call === 2) return whereChain([{ ordersCompleted: 5 }]);
      return whereChain([{ avgRating: "4.5", reviewCount: 3 }]);
    });

    const res = await getCookById(
      makeReq(`http://localhost/api/cooks/${COOK_ID}`),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(COOK_ID);
    expect(body.data.name).toBe("Maria Garcia");
  });

  it("returns 404 when cook not found", async () => {
    vi.mocked(db.select).mockImplementation(() => innerJoinLimitChain([]));

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

// ─── GET /api/cooks/[cookId]/listings ─────────────────────────────────────────

describe("GET /api/cooks/[cookId]/listings", () => {
  beforeEach(() => vi.clearAllMocks());

  const ctx = { params: Promise.resolve({ cookId: COOK_ID }) };

  it("returns 200 with listings array when cook exists", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([{ id: COOK_ID }]);
      return whereChain([MOCK_LISTING]);
    });

    const res = await getCookListings(
      makeReq(`http://localhost/api/cooks/${COOK_ID}/listings`),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("listing-uuid");
  });

  it("returns 404 when cook not found", async () => {
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await getCookListings(
      makeReq(`http://localhost/api/cooks/${COOK_ID}/listings`),
      ctx,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 with empty array when cook has no listings", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([{ id: COOK_ID }]);
      return whereChain([]);
    });

    const res = await getCookListings(
      makeReq(`http://localhost/api/cooks/${COOK_ID}/listings`),
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

    const res = await getCookListings(
      makeReq(`http://localhost/api/cooks/${COOK_ID}/listings`),
      ctx,
    );
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/cooks/[cookId]/reviews ──────────────────────────────────────────

describe("GET /api/cooks/[cookId]/reviews", () => {
  beforeEach(() => vi.clearAllMocks());

  const ctx = { params: Promise.resolve({ cookId: COOK_ID }) };

  it("returns 200 with reviews when cook exists", async () => {
    const mockReview = {
      id: "review-1",
      rating: 5,
      comment: "Excellent!",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      reviewerFirstName: "Alice",
      reviewerLastName: "Smith",
      listingTitle: "Homemade Tamales",
    };
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([{ id: COOK_ID }]);
      if (call === 2) return whereChain([{ total: 1 }]);
      return reviewsDataChain([mockReview]);
    });

    const res = await getCookReviews(
      makeReq(`http://localhost/api/cooks/${COOK_ID}/reviews`),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].reviewerName).toBe("Alice S.");
    expect(body.meta.total).toBe(1);
  });

  it("returns 404 when cook not found", async () => {
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await getCookReviews(
      makeReq(`http://localhost/api/cooks/${COOK_ID}/reviews`),
      ctx,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 with empty reviews when none exist", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([{ id: COOK_ID }]);
      if (call === 2) return whereChain([{ total: 0 }]);
      return reviewsDataChain([]);
    });

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
