import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  dishes: {},
  dishPhotos: {},
  dishIngredients: {},
  dishNutrition: {},
  dishTags: {},
  tags: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(() => ({ as: vi.fn((alias: string) => alias) })),
}));

import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/business/listings/dishes/[dishId]/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";

const mockDish = {
  id: "dish-uuid",
  cookId: COOK_ID,
  name: "Test",
  status: "active",
};

const params = Promise.resolve({ dishId: "dish-uuid" });

function makeGet(): NextRequest {
  return new NextRequest("http://localhost/dishes/dish-uuid", {
    method: "GET",
  });
}

function makePatch(body: unknown): NextRequest {
  return new NextRequest("http://localhost/dishes/dish-uuid", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "cook" } } as never) : null,
  );
}

function mockUpdate(row: object) {
  const returning = vi.fn().mockResolvedValue([row]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
}

describe("GET /api/business/listings/dishes/[dishId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when dish not found", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cookProfiles lookup
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      // dish ownership check — not found
      const limit = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 200 with full dish data including photos, ingredients, nutrition, and tags", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Call 1: cookProfiles lookup — terminal: limit
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      if (callCount === 2) {
        // Call 2: dish ownership + stats — terminal: limit
        const limit = vi.fn().mockResolvedValue([
          {
            dish: mockDish,
            listingCount: 0,
            totalOrders: 0,
            totalQty: 0,
          },
        ]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      if (callCount === 3) {
        // Call 3: dishPhotos — terminal: orderBy
        const orderBy = vi.fn().mockResolvedValue([]);
        const where = vi.fn(() => ({ orderBy }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      if (callCount === 4) {
        // Call 4: dishIngredients — terminal: orderBy
        const orderBy = vi.fn().mockResolvedValue([]);
        const where = vi.fn(() => ({ orderBy }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      if (callCount === 5) {
        // Call 5: dishNutrition — terminal: limit
        const limit = vi.fn().mockResolvedValue([]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      // Call 6: dishTags innerJoin tags — terminal: where
      const where = vi.fn().mockResolvedValue([]);
      const innerJoin = vi.fn(() => ({ where }));
      const from = vi.fn(() => ({ innerJoin }));
      return { from } as never;
    });

    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("photos");
    expect(body.data).toHaveProperty("ingredients");
    expect(body.data).toHaveProperty("nutrition");
    expect(body.data).toHaveProperty("tags");
    expect(body.data).toHaveProperty("stats");
  });

  it("returns 500 when dish ownership query throws", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cookProfiles lookup succeeds
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      // dish query throws
      const limit = vi.fn().mockRejectedValue(new Error("db failure"));
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe("PATCH /api/business/listings/dishes/[dishId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await PATCH(makePatch({ name: "New Name" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const req = new NextRequest("http://localhost/dishes/dish-uuid", {
      method: "PATCH",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 when body is empty object (schema defaults fill all boolean fields)", async () => {
    // The updateDishSchema applies .partial() over fields that have .default() values
    // (categories, isHalal, isVegan, etc.), so {} produces 8 keys from defaults and
    // the "No fields to update" guard is never reached. The route proceeds normally.
    mockSession(USER_ID);
    const updatedDish = { ...mockDish };
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cookProfiles lookup
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      // dish ownership check — found
      const limit = vi.fn().mockResolvedValue([{ id: mockDish.id }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    mockUpdate(updatedDish);

    const res = await PATCH(makePatch({}), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 404 when dish not found", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cookProfiles lookup
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      // dish ownership check — not found
      const limit = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await PATCH(makePatch({ name: "New Name" }), { params });
    expect(res.status).toBe(404);
  });

  it("returns 200 on valid patch", async () => {
    mockSession(USER_ID);
    const updatedDish = { ...mockDish, name: "New Name" };
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cookProfiles lookup
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      // dish ownership check — found
      const limit = vi.fn().mockResolvedValue([{ id: mockDish.id }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    mockUpdate(updatedDish);

    const res = await PATCH(makePatch({ name: "New Name" }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(updatedDish);
  });

  it("returns 409 on code 23505 from update", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cookProfiles lookup
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      // dish ownership check — found
      const limit = vi.fn().mockResolvedValue([{ id: mockDish.id }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const conflict = Object.assign(new Error("unique violation"), {
      code: "23505",
    });
    const returning = vi.fn().mockRejectedValue(conflict);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makePatch({ name: "New Name" }), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 500 on unexpected update error", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cookProfiles lookup
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      // dish ownership check — found
      const limit = vi.fn().mockResolvedValue([{ id: mockDish.id }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const returning = vi.fn().mockRejectedValue(new Error("unexpected"));
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makePatch({ name: "New Name" }), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
