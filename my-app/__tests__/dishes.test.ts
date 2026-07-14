import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    execute: vi.fn(),
  },
  dbPool: { transaction: vi.fn() },
}));
vi.mock("@/lib/dishes/status", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/dishes/status")>();
  return {
    ...mod,
    mapDishStatusForDb: vi.fn(
      async (status: "active" | "inactive" | "draft") =>
        status === "inactive"
          ? "inactive"
          : status === "draft"
            ? "draft"
            : "active",
    ),
  };
});
vi.mock("@/lib/search/index-builder", () => ({
  rebuildCookSearchIndexSafe: vi.fn(),
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
  sql: Object.assign(
    vi.fn().mockReturnValue({ as: vi.fn().mockReturnValue({}) }),
    { join: vi.fn() },
  ),
  getTableColumns: vi.fn().mockReturnValue({}),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/business/dishes/route";
import { db, dbPool } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";

const validCreateBody = {
  name: "Test Dish",
  price: 12.5,
  allergenNoneApplies: true,
  allergens: [],
};

function makeGet(url = "http://localhost/dishes"): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/dishes", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "cook" } } as never) : null,
  );
}

function mockCookLookup(cookId: string | null) {
  const limit = vi.fn().mockResolvedValue(cookId ? [{ id: cookId }] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

function mockTransaction(row: object) {
  vi.mocked(dbPool.transaction).mockImplementation(async (cb) => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([row]),
        })),
      })),
    };
    return cb(tx as never);
  });
}

describe("GET /api/business/listings/dishes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when session is null", async () => {
    mockSession(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 401 when cookProfiles returns empty (no cook profile)", async () => {
    mockSession(USER_ID);
    mockCookLookup(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty array when no dishes", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const orderBy = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it("returns 200 with dish rows", async () => {
    mockSession(USER_ID);
    const mockDishes = [
      { id: "dish-1", name: "Biryani", cookId: COOK_ID, status: "active" },
      { id: "dish-2", name: "Curry", cookId: COOK_ID, status: "active" },
    ];
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const orderBy = vi
        .fn()
        .mockResolvedValue(
          mockDishes.map((dish) => ({ dish, totalOrders: 0 })),
        );
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(
      mockDishes.map((dish) => ({
        ...dish,
        totalOrders: 0,
        canDelete: true,
      })),
    );
  });

  it("accepts valid ?status=active filter and returns 200", async () => {
    mockSession(USER_ID);
    const mockDishes = [{ id: "dish-1", name: "Biryani", status: "active" }];
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const orderBy = vi
        .fn()
        .mockResolvedValue(
          mockDishes.map((dish) => ({ dish, totalOrders: 0 })),
        );
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeGet("http://localhost/dishes?status=active"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("accepts ?status=draft filter and returns 200", async () => {
    mockSession(USER_ID);
    const mockDishes = [{ id: "draft-1", name: "WIP", status: "draft" }];
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const orderBy = vi
        .fn()
        .mockResolvedValue(
          mockDishes.map((dish) => ({ dish, totalOrders: 0 })),
        );
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeGet("http://localhost/dishes?status=draft"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([
      expect.objectContaining({ id: "draft-1", status: "draft" }),
    ]);
  });

  it("accepts ?status=inactive filter and returns 200", async () => {
    mockSession(USER_ID);
    const mockDishes = [{ id: "paused-1", name: "Paused", status: "inactive" }];
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const orderBy = vi
        .fn()
        .mockResolvedValue(
          mockDishes.map((dish) => ({ dish, totalOrders: 0 })),
        );
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeGet("http://localhost/dishes?status=inactive"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([
      expect.objectContaining({ id: "paused-1", status: "inactive" }),
    ]);
  });

  it("ignores invalid ?status param and still returns 200", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const orderBy = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeGet("http://localhost/dishes?status=invalid"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 on db error during dishes query", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const orderBy = vi.fn().mockRejectedValue(new Error("db failure"));
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeGet());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe("POST /api/business/listings/dishes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(makePost({ name: "Test Dish", price: 12.5 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockSession(USER_ID);
    mockCookLookup(COOK_ID);
    const req = new NextRequest("http://localhost/dishes", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when name is missing", async () => {
    mockSession(USER_ID);
    mockCookLookup(COOK_ID);
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when name is empty string", async () => {
    mockSession(USER_ID);
    mockCookLookup(COOK_ID);
    const res = await POST(makePost({ name: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when allergen declaration is missing", async () => {
    mockSession(USER_ID);
    mockCookLookup(COOK_ID);
    const res = await POST(makePost({ name: "Test Dish", price: 12.5 }));
    expect(res.status).toBe(400);
  });

  it("returns 201 on valid minimal body", async () => {
    mockSession(USER_ID);
    mockCookLookup(COOK_ID);
    const inserted = {
      id: "new-dish",
      name: "Test Dish",
      cookId: COOK_ID,
      status: "active",
    };
    mockTransaction(inserted);

    const res = await POST(makePost(validCreateBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(inserted);
  });

  it("inserts with status='active' by default", async () => {
    mockSession(USER_ID);
    mockCookLookup(COOK_ID);
    const inserted = {
      id: "new-dish",
      name: "Test Dish",
      cookId: COOK_ID,
      status: "active",
    };
    mockTransaction(inserted);

    await POST(makePost(validCreateBody));

    expect(vi.mocked(dbPool.transaction)).toHaveBeenCalledTimes(1);
  });

  it("returns 409 on code 23505 from insert", async () => {
    mockSession(USER_ID);
    mockCookLookup(COOK_ID);

    const conflict = Object.assign(new Error("unique violation"), {
      code: "23505",
    });
    vi.mocked(dbPool.transaction).mockRejectedValue(conflict);

    const res = await POST(makePost(validCreateBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 201 for a name-only draft without allergens or price", async () => {
    mockSession(USER_ID);
    mockCookLookup(COOK_ID);
    const inserted = {
      id: "draft-dish",
      name: "Half done",
      cookId: COOK_ID,
      status: "draft",
      price: "0.00",
    };
    mockTransaction(inserted);

    const res = await POST(makePost({ name: "Half done", status: "draft" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("draft");
  });

  it("stores zero price placeholder when draft omits price", async () => {
    mockSession(USER_ID);
    mockCookLookup(COOK_ID);
    let capturedPrice: string | undefined;
    vi.mocked(dbPool.transaction).mockImplementation(async (fn) => {
      const tx = {
        insert: () => ({
          values: (vals: { price?: string }) => {
            capturedPrice = vals.price;
            return {
              returning: async () => [
                {
                  id: "draft-dish",
                  name: "Half done",
                  cookId: COOK_ID,
                  status: "draft",
                  price: vals.price,
                },
              ],
            };
          },
        }),
      };
      return fn(tx as never);
    });

    await POST(makePost({ name: "Half done", status: "draft" }));
    expect(capturedPrice).toBe("0.00");
  });

  it("rejects active create without allergen declaration", async () => {
    mockSession(USER_ID);
    mockCookLookup(COOK_ID);
    const res = await POST(
      makePost({ name: "Test Dish", price: 12.5, status: "active" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when draft has empty name", async () => {
    mockSession(USER_ID);
    mockCookLookup(COOK_ID);
    const res = await POST(makePost({ name: "  ", status: "draft" }));
    expect(res.status).toBe(400);
  });
});
