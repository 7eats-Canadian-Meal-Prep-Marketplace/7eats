import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
  listings: {},
  dishes: {},
  listingDishes: {},
  listingPromotions: {},
  listingBundles: {},
  reviews: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  ilike: vi.fn(),
  isNull: vi.fn(),
  count: vi.fn().mockReturnValue({}),
  avg: vi.fn(),
  sql: Object.assign(vi.fn().mockReturnValue({}), {
    join: vi.fn().mockReturnValue({}),
  }),
}));

import { NextRequest } from "next/server";
import { GET as getListingReviews } from "@/app/api/listings/[listingId]/reviews/route";
import { GET as getListingById } from "@/app/api/listings/[listingId]/route";
import { GET as getListings } from "@/app/api/listings/route";
import { db } from "@/db";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeReq(url: string, method = "GET") {
  return new NextRequest(url, { method });
}

/** Simple chain: .from().where().limit() resolves to rows */
function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** Chain for count query: .from().leftJoin().leftJoin().where() resolves directly */
function countChain(total: number) {
  const where = vi.fn().mockResolvedValue([{ total }]);
  const leftJoin2 = vi.fn(() => ({ where }));
  const leftJoin1 = vi.fn(() => ({ leftJoin: leftJoin2 }));
  const from = vi.fn(() => ({ leftJoin: leftJoin1 }));
  return { from } as never;
}

/** Chain: .from().leftJoin().leftJoin().where().orderBy().limit().offset() */
function dataChain(rows: unknown[]) {
  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const leftJoin2 = vi.fn(() => ({ where }));
  const leftJoin1 = vi.fn(() => ({ leftJoin: leftJoin2 }));
  const from = vi.fn(() => ({ leftJoin: leftJoin1 }));
  return { from } as never;
}

/** Chain for listing detail: .from().leftJoin().leftJoin().where().limit() */
function detailChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const leftJoin2 = vi.fn(() => ({ where }));
  const leftJoin1 = vi.fn(() => ({ leftJoin: leftJoin2 }));
  const from = vi.fn(() => ({ leftJoin: leftJoin1 }));
  return { from } as never;
}

/** Chain: .from().leftJoin().where().orderBy().limit().offset() */
function reviewsDataChain(rows: unknown[]) {
  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const leftJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ leftJoin }));
  return { from } as never;
}

/** Chain for reviews count: .from().where() resolves directly */
function reviewsCountChain(total: number) {
  const where = vi.fn().mockResolvedValue([{ total }]);
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** Chain for listing detail dishes: .from().leftJoin().where() */
function dishesChain(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const leftJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ leftJoin }));
  return { from } as never;
}

/** Chain for listing bundles: .from().where().orderBy() */
function bundlesChain(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

const LISTING_ID = "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6";

const MOCK_LISTING_ROW = {
  id: LISTING_ID,
  title: "Homemade Pasta",
  description: "Delicious fresh pasta",
  cookId: "cook-uuid",
  cookName: "John D.",
  cookFirstName: "John",
  basePrice: "25.00",
  type: "one_time",
  subscriptionEnabled: false,
  coverPhotoUrl: null,
  minOrderQty: 1,
  maxOrderQty: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const MOCK_DETAIL_ROW = {
  ...MOCK_LISTING_ROW,
  currency: "CAD",
  depositEnabled: false,
  cookNeighborhood: "Downtown",
};

// ─── GET /api/listings ────────────────────────────────────────────────────────

describe("GET /api/listings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with data and meta on success", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return countChain(1);
      return dataChain([MOCK_LISTING_ROW]);
    });

    const res = await getListings(makeReq("http://localhost/api/listings"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
    expect(body.meta.total).toBe(1);
  });

  it("returns 200 with empty array when no listings", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return countChain(0);
      return dataChain([]);
    });

    const res = await getListings(makeReq("http://localhost/api/listings"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it("respects ?limit param (clamped to max 100)", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return countChain(0);
      return dataChain([]);
    });

    const res = await getListings(
      makeReq("http://localhost/api/listings?limit=5"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.limit).toBe(5);
  });

  it("clamps limit to 100 when ?limit is too large", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return countChain(0);
      return dataChain([]);
    });

    const res = await getListings(
      makeReq("http://localhost/api/listings?limit=999"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.limit).toBe(100);
  });

  it("uses default limit=50 and offset=0 when not provided", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return countChain(0);
      return dataChain([]);
    });

    const res = await getListings(makeReq("http://localhost/api/listings"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.limit).toBe(50);
    expect(body.meta.offset).toBe(0);
  });

  it("accepts ?q search param without error", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return countChain(0);
      return dataChain([]);
    });

    const res = await getListings(
      makeReq("http://localhost/api/listings?q=pasta"),
    );
    expect(res.status).toBe(200);
  });

  it("returns 500 on db error", async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("db failure");
    });

    const res = await getListings(makeReq("http://localhost/api/listings"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ─── GET /api/listings/[listingId] ────────────────────────────────────────────

describe("GET /api/listings/[listingId]", () => {
  beforeEach(() => vi.clearAllMocks());

  const ctx = { params: Promise.resolve({ listingId: LISTING_ID }) };

  it("returns 200 with listing data when found", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return detailChain([MOCK_DETAIL_ROW]);
      if (call === 2) return dishesChain([]);
      if (call === 3) return limitChain([]); // promotion
      return bundlesChain([]);
    });

    const res = await getListingById(
      makeReq(`http://localhost/api/listings/${LISTING_ID}`),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(LISTING_ID);
    expect(body.data.cook).toBeDefined();
  });

  it("returns 404 when listing not found", async () => {
    vi.mocked(db.select).mockImplementation(() => detailChain([]));

    const res = await getListingById(
      makeReq(`http://localhost/api/listings/${LISTING_ID}`),
      ctx,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("includes promotion data when an active promotion exists", async () => {
    const promo = { id: "promo-1", type: "percentage_off", value: "15" };
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return detailChain([MOCK_DETAIL_ROW]);
      if (call === 2) return dishesChain([]);
      if (call === 3) return limitChain([promo]);
      return bundlesChain([]);
    });

    const res = await getListingById(
      makeReq(`http://localhost/api/listings/${LISTING_ID}`),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.promotion).not.toBeNull();
    expect(body.data.promotion.type).toBe("percentage_off");
  });

  it("returns 500 on db error", async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("db error");
    });

    const res = await getListingById(
      makeReq(`http://localhost/api/listings/${LISTING_ID}`),
      ctx,
    );
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/listings/[listingId]/reviews ────────────────────────────────────

describe("GET /api/listings/[listingId]/reviews", () => {
  beforeEach(() => vi.clearAllMocks());

  const ctx = { params: Promise.resolve({ listingId: LISTING_ID }) };

  it("returns 200 with reviews array on success", async () => {
    const mockReview = {
      id: "review-1",
      rating: 5,
      comment: "Amazing!",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      firstName: "Alice",
      lastName: "Smith",
    };
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return reviewsCountChain(1);
      return reviewsDataChain([mockReview]);
    });

    const res = await getListingReviews(
      makeReq(`http://localhost/api/listings/${LISTING_ID}/reviews`),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].rating).toBe(5);
    expect(body.meta.total).toBe(1);
  });

  it("returns 200 with empty array when no reviews", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return reviewsCountChain(0);
      return reviewsDataChain([]);
    });

    const res = await getListingReviews(
      makeReq(`http://localhost/api/listings/${LISTING_ID}/reviews`),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("formats reviewerName with last initial", async () => {
    const mockReview = {
      id: "review-2",
      rating: 4,
      comment: null,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      firstName: "Bob",
      lastName: "Johnson",
    };
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return reviewsCountChain(1);
      return reviewsDataChain([mockReview]);
    });

    const res = await getListingReviews(
      makeReq(`http://localhost/api/listings/${LISTING_ID}/reviews`),
      ctx,
    );
    const body = await res.json();
    expect(body.data[0].reviewerName).toBe("Bob J.");
  });

  it("returns 500 on db error", async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("db error");
    });

    const res = await getListingReviews(
      makeReq(`http://localhost/api/listings/${LISTING_ID}/reviews`),
      ctx,
    );
    expect(res.status).toBe(500);
  });
});
