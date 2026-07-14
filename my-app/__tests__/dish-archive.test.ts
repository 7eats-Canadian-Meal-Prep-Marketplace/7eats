import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
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
vi.mock("@/lib/dishes/lifecycle", () => ({
  getDishLifecycleInfo: vi.fn(),
}));
vi.mock("@/lib/dishes/status", () => ({
  isDishDraft: vi.fn((status: string) => status === "draft"),
  isDishPaused: vi.fn(
    (status: string) => status === "inactive" || status === "archived",
  ),
  setDishPaused: vi.fn(),
  setDishActive: vi.fn(),
}));
vi.mock("@/lib/search/index-builder", () => ({
  rebuildCookSearchIndexSafe: vi.fn(),
}));

import { NextRequest } from "next/server";
import { POST as archivePost } from "@/app/api/business/dishes/[dishId]/archive/route";
import { POST as unarchivePost } from "@/app/api/business/dishes/[dishId]/unarchive/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { getDishLifecycleInfo } from "@/lib/dishes/lifecycle";
import { setDishActive, setDishPaused } from "@/lib/dishes/status";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const DISH_ID = "dish-uuid";

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

function makeArchivePost(): NextRequest {
  return new NextRequest("http://localhost/dishes/dish-uuid/archive", {
    method: "POST",
  });
}

function makeUnarchivePost(): NextRequest {
  return new NextRequest("http://localhost/dishes/dish-uuid/unarchive", {
    method: "POST",
  });
}

const params = { params: Promise.resolve({ dishId: DISH_ID }) };

const dishBase = {
  id: DISH_ID,
  cookId: COOK_ID,
  name: "Test",
  description: null,
  cuisine: null,
  categories: [],
  isHalal: false,
  isVegan: false,
  isVegetarian: false,
  isGlutenFree: false,
  isDairyFree: false,
  isNutFree: false,
  isKosher: false,
  servingSize: null,
  price: "12.00",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const activeDish = { ...dishBase, status: "active" as const };
const archivedDish = { ...dishBase, status: "inactive" as const };
const draftDish = { ...dishBase, status: "draft" as const };
const updatedDish = { ...dishBase, status: "inactive" as const };
const activatedDish = { ...dishBase, status: "active" as const };
const updatedDishResponse = {
  ...updatedDish,
  createdAt: updatedDish.createdAt.toISOString(),
  updatedAt: updatedDish.updatedAt.toISOString(),
};
const activatedDishResponse = {
  ...activatedDish,
  createdAt: activatedDish.createdAt.toISOString(),
  updatedAt: activatedDish.updatedAt.toISOString(),
};

describe("POST /api/business/listings/dishes/[dishId]/archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);
  });

  it("returns 401 when session is null", async () => {
    mockSession(null);

    const res = await archivePost(makeArchivePost(), params);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 401 when no cook profile exists for the user", async () => {
    mockSession(USER_ID);
    mockCookLookup(null);

    const res = await archivePost(makeArchivePost(), params);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 404 when the dish is not found", async () => {
    mockSession(USER_ID);
    mockTwoSelects(null);

    const res = await archivePost(makeArchivePost(), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 400 when the dish is a draft", async () => {
    mockSession(USER_ID);
    mockTwoSelects(draftDish);

    const res = await archivePost(makeArchivePost(), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/draft/i);
    expect(setDishPaused).not.toHaveBeenCalled();
  });

  it("returns 400 when the dish is already archived", async () => {
    mockSession(USER_ID);
    mockTwoSelects(archivedDish);

    const res = await archivePost(makeArchivePost(), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Meal is already archived.");
  });

  it("returns 400 when the dish is already archived (legacy status)", async () => {
    mockSession(USER_ID);
    mockTwoSelects({ id: DISH_ID, status: "archived" });

    const res = await archivePost(makeArchivePost(), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Meal is already archived.");
  });

  it("returns 409 when the meal is on open orders", async () => {
    mockSession(USER_ID);
    mockTwoSelects(activeDish);
    vi.mocked(getDishLifecycleInfo).mockResolvedValue({
      totalOrders: 2,
      openOrderCount: 1,
      isLastActiveDish: false,
      canDelete: false,
    });

    const res = await archivePost(makeArchivePost(), params);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("1 open order");
    expect(setDishPaused).not.toHaveBeenCalled();
  });

  it("returns 200 with updated dish on success", async () => {
    mockSession(USER_ID);
    mockTwoSelects(activeDish);
    vi.mocked(getDishLifecycleInfo).mockResolvedValue({
      totalOrders: 0,
      openOrderCount: 0,
      isLastActiveDish: true,
      canDelete: true,
    });
    vi.mocked(setDishPaused).mockResolvedValue(updatedDish);

    const res = await archivePost(makeArchivePost(), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(updatedDishResponse);
    expect(body.hiddenFromBrowse).toBe(true);
  });

  it("returns 500 on unexpected DB error during update", async () => {
    mockSession(USER_ID);
    mockTwoSelects(activeDish);
    vi.mocked(getDishLifecycleInfo).mockResolvedValue({
      totalOrders: 0,
      openOrderCount: 0,
      isLastActiveDish: false,
      canDelete: true,
    });
    vi.mocked(setDishPaused).mockRejectedValue(new Error("DB error"));

    const res = await archivePost(makeArchivePost(), params);

    expect(res.status).toBe(500);
  });
});

describe("POST /api/business/listings/dishes/[dishId]/unarchive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);
  });

  it("returns 401 when session is null", async () => {
    mockSession(null);

    const res = await unarchivePost(makeUnarchivePost(), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the dish is not found", async () => {
    mockSession(USER_ID);
    mockTwoSelects(null);

    const res = await unarchivePost(makeUnarchivePost(), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 when activating a draft", async () => {
    mockSession(USER_ID);
    mockTwoSelects(draftDish);

    const res = await unarchivePost(makeUnarchivePost(), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/draft/i);
    expect(setDishActive).not.toHaveBeenCalled();
  });

  it("returns 400 when the meal is already active", async () => {
    mockSession(USER_ID);
    mockTwoSelects(activeDish);

    const res = await unarchivePost(makeUnarchivePost(), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Meal is already active.");
    expect(setDishActive).not.toHaveBeenCalled();
  });

  it("returns 200 when reactivating an inactive meal", async () => {
    mockSession(USER_ID);
    mockTwoSelects(archivedDish);
    vi.mocked(setDishActive).mockResolvedValue(activatedDish);

    const res = await unarchivePost(makeUnarchivePost(), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(activatedDishResponse);
    expect(setDishActive).toHaveBeenCalledWith(DISH_ID, COOK_ID);
  });

  it("returns 200 when reactivating a legacy archived meal", async () => {
    mockSession(USER_ID);
    mockTwoSelects({ ...dishBase, status: "archived" });
    vi.mocked(setDishActive).mockResolvedValue(activatedDish);

    const res = await unarchivePost(makeUnarchivePost(), params);
    expect(res.status).toBe(200);
    expect(setDishActive).toHaveBeenCalled();
  });
});
