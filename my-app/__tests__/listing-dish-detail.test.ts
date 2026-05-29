import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  listings: {},
  listingDishes: {},
  orders: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), ne: vi.fn() }));

import { NextRequest } from "next/server";
import {
  DELETE,
  PATCH,
} from "@/app/api/business/listings/[listingId]/dishes/[dishId]/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const LISTING_ID = "listing-uuid";
const DISH_ID = "dish-uuid";

const params = Promise.resolve({ listingId: LISTING_ID, dishId: DISH_ID });

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId } } as never) : null,
  );
}

function makePatch(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/listings/${LISTING_ID}/dishes/${DISH_ID}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    },
  );
}

function makeDelete(): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/listings/${LISTING_ID}/dishes/${DISH_ID}`,
    { method: "DELETE" },
  );
}

/** Builds a fluent select mock that resolves .limit() with `result`. */
function makeSelectCall(result: object[]) {
  const limit = vi.fn().mockResolvedValue(result);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function mockDelete() {
  const where = vi.fn().mockResolvedValue(undefined);
  vi.mocked(db.delete).mockReturnValue({ where } as never);
}

// ---------------------------------------------------------------------------
// PATCH tests
// ---------------------------------------------------------------------------
describe("PATCH /api/business/listings/[listingId]/dishes/[dishId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await PATCH(makePatch({ quantity: 2 }), { params });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for invalid JSON body", async () => {
    mockSession(USER_ID);
    // Call 1: cookProfiles → found
    vi.mocked(db.select).mockReturnValueOnce(makeSelectCall([{ id: COOK_ID }]));
    const req = new NextRequest(
      `http://localhost/api/business/listings/${LISTING_ID}/dishes/${DISH_ID}`,
      {
        method: "PATCH",
        body: "not-json",
        headers: { "content-type": "application/json" },
      },
    );
    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request body.");
  });

  it("returns 400 for empty object (no fields to update)", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockReturnValueOnce(makeSelectCall([{ id: COOK_ID }]));
    const res = await PATCH(makePatch({}), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No fields to update.");
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
    const res = await PATCH(makePatch({ quantity: 2 }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when dish not in listing", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectCall([{ id: COOK_ID }]);
      if (callCount === 2) return makeSelectCall([{ id: LISTING_ID }]);
      // Call 3: listingDish → not found
      return makeSelectCall([]);
    });
    const res = await PATCH(makePatch({ quantity: 2 }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 on valid update", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectCall([{ id: COOK_ID }]);
      if (callCount === 2) return makeSelectCall([{ id: LISTING_ID }]);
      return makeSelectCall([{ id: "ld-uuid" }]);
    });
    const updated = {
      id: "ld-uuid",
      listingId: LISTING_ID,
      dishId: DISH_ID,
      quantity: 3,
      sortOrder: 1,
    };
    const returning = vi.fn().mockResolvedValue([updated]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makePatch({ quantity: 3, sortOrder: 1 }), {
      params,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(updated);
  });

  it("returns 500 on db error during update", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectCall([{ id: COOK_ID }]);
      if (callCount === 2) return makeSelectCall([{ id: LISTING_ID }]);
      return makeSelectCall([{ id: "ld-uuid" }]);
    });
    const returning = vi.fn().mockRejectedValue(new Error("db failure"));
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makePatch({ quantity: 2 }), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DELETE tests
// ---------------------------------------------------------------------------
describe("DELETE /api/business/listings/[listingId]/dishes/[dishId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(401);
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
    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 409 when non-cancelled order exists", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectCall([{ id: COOK_ID }]);
      if (callCount === 2) return makeSelectCall([{ id: LISTING_ID }]);
      // Call 3: orders lock check → active order found
      return makeSelectCall([{ id: "order-1" }]);
    });
    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe(
      "Cannot change composition while active orders exist.",
    );
  });

  it("returns 200 on successful delete (no active orders)", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectCall([{ id: COOK_ID }]);
      if (callCount === 2) return makeSelectCall([{ id: LISTING_ID }]);
      // Call 3: orders lock check → no active orders
      return makeSelectCall([]);
    });
    mockDelete();

    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 on db error during delete", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectCall([{ id: COOK_ID }]);
      if (callCount === 2) return makeSelectCall([{ id: LISTING_ID }]);
      return makeSelectCall([]);
    });
    const where = vi.fn().mockRejectedValue(new Error("db failure"));
    vi.mocked(db.delete).mockReturnValue({ where } as never);

    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
