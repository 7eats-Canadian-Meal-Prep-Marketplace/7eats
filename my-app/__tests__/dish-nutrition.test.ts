vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  dishes: {},
  dishNutrition: { dishId: "dish_id" },
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "@/app/api/business/listings/dishes/[dishId]/nutrition/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const DISH_ID = "dish-uuid";

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId } } as never) : null,
  );
}

// call 1 = cookProfiles(limit), call 2 = dish(limit)
function mockTwoSelects(dishRow: object | null) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    const rows = callCount === 1 ? [{ id: COOK_ID }] : dishRow ? [dishRow] : [];
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    return { from } as never;
  });
}

function mockUpsert(row: object) {
  const returning = vi.fn().mockResolvedValue([row]);
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  vi.mocked(db.insert).mockReturnValue({ values } as never);
}

const mockDish = { id: DISH_ID };
const mockNutrition = {
  id: "nut-uuid",
  dishId: DISH_ID,
  calories: 350,
  proteinG: "25.50",
  carbsG: "30.00",
  fatG: null,
  updatedAt: "2026-05-29T00:00:00.000Z",
};
const params = { params: Promise.resolve({ dishId: DISH_ID }) };

function makePut(body: unknown): NextRequest {
  return new NextRequest("http://localhost/nutrition", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PUT /dishes/:id/nutrition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);

    const res = await PUT(makePut({}), params);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 404 when dish not found", async () => {
    mockSession(USER_ID);
    mockTwoSelects(null);

    const res = await PUT(makePut({}), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    const req = new NextRequest("http://localhost/nutrition", {
      method: "PUT",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PUT(req, params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 for negative calories", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    const res = await PUT(makePut({ calories: -1 }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 for negative proteinG", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    const res = await PUT(makePut({ proteinG: -5 }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 200 on valid partial body", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);
    mockUpsert(mockNutrition);

    const res = await PUT(makePut({ calories: 350, proteinG: 25.5 }), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockNutrition);
  });

  it("returns 200 on empty body (all fields optional)", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);
    mockUpsert(mockNutrition);

    const res = await PUT(makePut({}), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockNutrition);
  });

  it("returns 500 on DB error during upsert", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    const returning = vi.fn().mockRejectedValue(new Error("DB error"));
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    vi.mocked(db.insert).mockReturnValue({ values } as never);

    const res = await PUT(makePut({ calories: 350 }), params);

    expect(res.status).toBe(500);
  });
});
