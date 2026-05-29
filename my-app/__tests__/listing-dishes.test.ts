import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  listings: {},
  listingDishes: {},
  dishes: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), ne: vi.fn() }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/business/listings/[listingId]/dishes/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const LISTING_ID = "listing-uuid";
const DISH_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const params = Promise.resolve({ listingId: LISTING_ID });

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId } } as never) : null,
  );
}

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/listings/${LISTING_ID}/dishes`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    },
  );
}

function mockInsert(row: object) {
  const returning = vi.fn().mockResolvedValue([row]);
  const values = vi.fn(() => ({ returning }));
  vi.mocked(db.insert).mockReturnValue({ values } as never);
}

/** Builds a fluent select mock that resolves .limit() with `result`. */
function makeSelectCall(result: object[]) {
  const limit = vi.fn().mockResolvedValue(result);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

describe("POST /api/business/listings/[listingId]/dishes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated (session null)", async () => {
    mockSession(null);
    const res = await POST(makePost({ dishId: DISH_ID }), { params });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 401 when no cook profile", async () => {
    mockSession(USER_ID);
    // Call 1: cookProfiles → empty
    vi.mocked(db.select).mockReturnValueOnce(makeSelectCall([]));
    const res = await POST(makePost({ dishId: DISH_ID }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockSession(USER_ID);
    // Call 1: cookProfiles → found
    vi.mocked(db.select).mockReturnValueOnce(makeSelectCall([{ id: COOK_ID }]));
    const req = new NextRequest(
      `http://localhost/api/business/listings/${LISTING_ID}/dishes`,
      {
        method: "POST",
        body: "not-json",
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request body.");
  });

  it("returns 400 when dishId is missing", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockReturnValueOnce(makeSelectCall([{ id: COOK_ID }]));
    const res = await POST(makePost({}), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when dishId is not a valid UUID", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockReturnValueOnce(makeSelectCall([{ id: COOK_ID }]));
    const res = await POST(makePost({ dishId: "not-a-uuid" }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when listing not found", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectCall([{ id: COOK_ID }]);
      // Call 2: listing → not found
      return makeSelectCall([]);
    });
    const res = await POST(makePost({ dishId: DISH_ID }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when dish not found (or archived)", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectCall([{ id: COOK_ID }]);
      if (callCount === 2) return makeSelectCall([{ id: LISTING_ID }]);
      // Call 3: dish → not found
      return makeSelectCall([]);
    });
    const res = await POST(makePost({ dishId: DISH_ID }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 201 on valid insert", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectCall([{ id: COOK_ID }]);
      if (callCount === 2) return makeSelectCall([{ id: LISTING_ID }]);
      return makeSelectCall([{ id: DISH_ID }]);
    });
    const inserted = {
      id: "ld-uuid",
      listingId: LISTING_ID,
      dishId: DISH_ID,
      quantity: 1,
      sortOrder: 0,
    };
    mockInsert(inserted);

    const res = await POST(makePost({ dishId: DISH_ID }), { params });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(inserted);
  });

  it("returns 409 on code 23505 (dish already in listing)", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectCall([{ id: COOK_ID }]);
      if (callCount === 2) return makeSelectCall([{ id: LISTING_ID }]);
      return makeSelectCall([{ id: DISH_ID }]);
    });
    const conflict = Object.assign(new Error("unique violation"), {
      code: "23505",
    });
    const returning = vi.fn().mockRejectedValue(conflict);
    const values = vi.fn(() => ({ returning }));
    vi.mocked(db.insert).mockReturnValue({ values } as never);

    const res = await POST(makePost({ dishId: DISH_ID }), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Dish is already in this listing.");
  });

  it("returns 500 on unexpected db error", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectCall([{ id: COOK_ID }]);
      if (callCount === 2) return makeSelectCall([{ id: LISTING_ID }]);
      return makeSelectCall([{ id: DISH_ID }]);
    });
    const returning = vi.fn().mockRejectedValue(new Error("unexpected"));
    const values = vi.fn(() => ({ returning }));
    vi.mocked(db.insert).mockReturnValue({ values } as never);

    const res = await POST(makePost({ dishId: DISH_ID }), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
