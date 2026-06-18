vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  dishes: {},
  dishIngredients: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DELETE,
  PATCH,
} from "@/app/api/business/dishes/[dishId]/ingredients/[ingredientId]/route";
import { POST } from "@/app/api/business/dishes/[dishId]/ingredients/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const DISH_ID = "dish-uuid";
const INGREDIENT_ID = "ingredient-uuid";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockDish = { id: DISH_ID };
const mockIngredient = {
  id: INGREDIENT_ID,
  dishId: DISH_ID,
  name: "Flour",
  quantity: "2 cups",
  isAllergen: false,
  sortOrder: 0,
};
const validAddBody = { name: "Flour", quantity: "2 cups" };

// ---------------------------------------------------------------------------
// Route params
// ---------------------------------------------------------------------------

const dishParams = { params: Promise.resolve({ dishId: DISH_ID }) };
const ingredientParams = {
  params: Promise.resolve({ dishId: DISH_ID, ingredientId: INGREDIENT_ID }),
};

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/ingredients", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makePatch(body: unknown): NextRequest {
  return new NextRequest("http://localhost/ingredients/id", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeDelete(): NextRequest {
  return new NextRequest("http://localhost/ingredients/id", {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "cook" } } as never) : null,
  );
}

// Two sequential selects:
// call 1: cookProfiles lookup (terminal: limit) → returns [{ id: COOK_ID }] or []
// call 2: dish lookup (terminal: limit) → returns [dish] or []
function mockTwoSelects(cookFound: boolean, dishRow: object | null) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    let rows: object[];
    if (callCount === 1) rows = cookFound ? [{ id: COOK_ID }] : [];
    else rows = dishRow ? [dishRow] : [];
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    return { from } as never;
  });
}

// Three sequential selects:
// call 1: cookProfiles (limit)
// call 2: dish ownership (limit)
// call 3: ingredient lookup (limit)
function mockThreeSelects(
  dishRow: object | null,
  ingredientRow: object | null,
) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    let rows: object[];
    if (callCount === 1) rows = [{ id: COOK_ID }];
    else if (callCount === 2) rows = dishRow ? [dishRow] : [];
    else rows = ingredientRow ? [ingredientRow] : [];
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    return { from } as never;
  });
}

// ---------------------------------------------------------------------------
// POST /dishes/:id/ingredients
// ---------------------------------------------------------------------------

describe("POST /dishes/:id/ingredients", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(makePost(validAddBody), dishParams);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when dish not found", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, null);
    const res = await POST(makePost(validAddBody), dishParams);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for invalid JSON body", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, mockDish);
    const req = new NextRequest("http://localhost/ingredients", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, dishParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when name is missing", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, mockDish);
    const res = await POST(makePost({}), dishParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when name is empty string", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, mockDish);
    const res = await POST(makePost({ name: "" }), dishParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 201 on valid body", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, mockDish);
    const returning = vi.fn().mockResolvedValue([mockIngredient]);
    const values = vi.fn(() => ({ returning }));
    vi.mocked(db.insert).mockReturnValue({ values } as never);

    const res = await POST(makePost(validAddBody), dishParams);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockIngredient);
  });

  it("returns 500 on DB insert error", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, mockDish);
    const returning = vi.fn().mockRejectedValue(new Error("db failure"));
    const values = vi.fn(() => ({ returning }));
    vi.mocked(db.insert).mockReturnValue({ values } as never);

    const res = await POST(makePost(validAddBody), dishParams);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PATCH /dishes/:id/ingredients/:id
// ---------------------------------------------------------------------------

describe("PATCH /dishes/:id/ingredients/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await PATCH(makePatch({ name: "Salt" }), ingredientParams);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when dish not found", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, null);
    const res = await PATCH(makePatch({ name: "Salt" }), ingredientParams);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 with 'No fields to update.' when body is empty", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, mockDish);
    const res = await PATCH(makePatch({}), ingredientParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No fields to update.");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, mockDish);
    const req = new NextRequest("http://localhost/ingredients/id", {
      method: "PATCH",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, ingredientParams);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when ingredient not found", async () => {
    mockSession(USER_ID);
    mockThreeSelects(mockDish, null);
    const res = await PATCH(makePatch({ name: "Salt" }), ingredientParams);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 on valid patch", async () => {
    mockSession(USER_ID);
    mockThreeSelects(mockDish, mockIngredient);
    const returning = vi
      .fn()
      .mockResolvedValue([{ ...mockIngredient, name: "Salt" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makePatch({ name: "Salt" }), ingredientParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ name: "Salt" });
  });

  it("returns 500 on DB update error", async () => {
    mockSession(USER_ID);
    mockThreeSelects(mockDish, mockIngredient);
    const returning = vi.fn().mockRejectedValue(new Error("db failure"));
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makePatch({ name: "Salt" }), ingredientParams);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DELETE /dishes/:id/ingredients/:id
// ---------------------------------------------------------------------------

describe("DELETE /dishes/:id/ingredients/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await DELETE(makeDelete(), ingredientParams);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when dish not found", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, null);
    const res = await DELETE(makeDelete(), ingredientParams);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 on successful delete", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, mockDish);
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    } as never);

    const res = await DELETE(makeDelete(), ingredientParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 on DB error", async () => {
    mockSession(USER_ID);
    mockTwoSelects(true, mockDish);
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockRejectedValue(new Error("db failure")),
    } as never);

    const res = await DELETE(makeDelete(), ingredientParams);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
