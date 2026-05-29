import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbPool: { transaction: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  dishes: {},
  dishPhotos: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/business/listings/dishes/[dishId]/archive/route";
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

function mockCookLookup(cookId: string | null) {
  const limit = vi.fn().mockResolvedValue(cookId ? [{ id: cookId }] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

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

function mockUpdate(row: object) {
  const returning = vi.fn().mockResolvedValue([row]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
}

function makePost(): NextRequest {
  return new NextRequest("http://localhost/dishes/dish-uuid/archive", {
    method: "POST",
  });
}

const params = { params: Promise.resolve({ dishId: DISH_ID }) };

const activeDish = { id: DISH_ID, status: "active" };
const archivedDish = { id: DISH_ID, status: "archived" };
const updatedDish = { id: DISH_ID, status: "archived", name: "Test" };

describe("POST /api/business/listings/dishes/[dishId]/archive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when session is null", async () => {
    mockSession(null);

    const res = await POST(makePost(), params);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 401 when no cook profile exists for the user", async () => {
    mockSession(USER_ID);
    mockCookLookup(null);

    const res = await POST(makePost(), params);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 404 when the dish is not found", async () => {
    mockSession(USER_ID);
    mockTwoSelects(null);

    const res = await POST(makePost(), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 400 when the dish is already archived", async () => {
    mockSession(USER_ID);
    mockTwoSelects(archivedDish);

    const res = await POST(makePost(), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Dish is already archived.");
  });

  it("returns 200 with updated dish on success", async () => {
    mockSession(USER_ID);
    mockTwoSelects(activeDish);
    mockUpdate(updatedDish);

    const res = await POST(makePost(), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(updatedDish);
  });

  it("returns 500 on unexpected DB error during update", async () => {
    mockSession(USER_ID);
    mockTwoSelects(activeDish);

    const where = vi.fn().mockRejectedValue(new Error("DB error"));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await POST(makePost(), params);

    expect(res.status).toBe(500);
  });
});
