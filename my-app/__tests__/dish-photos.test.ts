import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  DELETE,
  PATCH,
} from "@/app/api/business/listings/dishes/[dishId]/photos/[photoId]/route";
import { POST } from "@/app/api/business/listings/dishes/[dishId]/photos/route";
import { db, dbPool } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const DISH_ID = "dish-uuid";
const PHOTO_ID = "photo-uuid";

const mockDish = { id: DISH_ID };
const mockPhoto = {
  id: PHOTO_ID,
  dishId: DISH_ID,
  url: "https://example.com/photo.jpg",
  isPrimary: false,
  sortOrder: 0,
};

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

function mockUpdate(row: object) {
  const returning = vi.fn().mockResolvedValue([row]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
}

function mockInsert(row: object) {
  const returning = vi.fn().mockResolvedValue([row]);
  const values = vi.fn(() => ({ returning }));
  vi.mocked(db.insert).mockReturnValue({ values } as never);
}

function mockTransaction(photo: object) {
  vi.mocked(dbPool.transaction).mockImplementation(async (cb) => {
    const tx = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([photo]),
        }),
      }),
    };
    return cb(tx as never);
  });
}

function mockPatchTransaction(photo: object) {
  vi.mocked(dbPool.transaction).mockImplementation(async (cb) => {
    const tx = {
      update: vi
        .fn()
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        })
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([photo]),
            }),
          }),
        }),
    };
    return cb(tx as never);
  });
}

function makePost(body: unknown): Request {
  return new Request("http://localhost/dishes/dish-uuid/photos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makePatch(body: unknown): Request {
  return new Request("http://localhost/dishes/dish-uuid/photos/photo-uuid", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeDelete(): Request {
  return new Request("http://localhost/dishes/dish-uuid/photos/photo-uuid", {
    method: "DELETE",
  });
}

const dishParams = { params: Promise.resolve({ dishId: DISH_ID }) };
const photoParams = {
  params: Promise.resolve({ dishId: DISH_ID, photoId: PHOTO_ID }),
};

// ---------------------------------------------------------------------------
// POST /dishes/:id/photos
// ---------------------------------------------------------------------------

const CDN = "https://cdn.7eats.test";

describe("POST /api/business/listings/dishes/[dishId]/photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("R2_PUBLIC_BUCKET_URL_LISTINGS", CDN);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);

    const res = await POST(
      makePost({ url: "https://example.com/photo.jpg" }),
      dishParams,
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 404 when the dish is not found", async () => {
    mockSession(USER_ID);
    mockTwoSelects(null);

    const res = await POST(
      makePost({ url: "https://example.com/photo.jpg" }),
      dishParams,
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 422 for invalid body (non-URL url field)", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    const res = await POST(makePost({ url: "not-a-url" }), dishParams);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBeDefined();
  });

  it("returns 422 for a URL not hosted on the CDN", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    const res = await POST(
      makePost({ url: "https://evil.example.com/photo.jpg" }),
      dishParams,
    );

    expect(res.status).toBe(422);
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
  });

  it("returns 201 for a simple insert when isPrimary is false (default)", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);
    mockInsert(mockPhoto);

    const res = await POST(
      makePost({ url: `${CDN}/listings/photo.jpg` }),
      dishParams,
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockPhoto);
    expect(vi.mocked(dbPool.transaction)).not.toHaveBeenCalled();
  });

  it("returns 201 and uses a transaction when isPrimary is true", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);
    mockTransaction(mockPhoto);

    const res = await POST(
      makePost({ url: `${CDN}/listings/photo.jpg`, isPrimary: true }),
      dishParams,
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockPhoto);
    expect(vi.mocked(dbPool.transaction)).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when the insert throws a DB error", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(new Error("db")),
      }),
    } as never);

    const res = await POST(
      makePost({ url: `${CDN}/listings/photo.jpg` }),
      dishParams,
    );

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /dishes/:id/photos/:photoId
// ---------------------------------------------------------------------------

describe("PATCH /api/business/listings/dishes/[dishId]/photos/[photoId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);

    const res = await PATCH(makePatch({ sortOrder: 1 }), photoParams);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 404 when the dish is not found", async () => {
    mockSession(USER_ID);
    mockTwoSelects(null);

    const res = await PATCH(makePatch({ sortOrder: 1 }), photoParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 400 when no fields are provided", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    const res = await PATCH(makePatch({}), photoParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No fields to update.");
  });

  it("returns 404 when the photo is not found", async () => {
    mockSession(USER_ID);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      const rows =
        callCount === 1 ? [{ id: COOK_ID }] : callCount === 2 ? [mockDish] : [];
      const limit = vi.fn().mockResolvedValue(rows);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await PATCH(makePatch({ sortOrder: 1 }), photoParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 200 for a simple update (sortOrder only, no primary change)", async () => {
    mockSession(USER_ID);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      const rows =
        callCount === 1
          ? [{ id: COOK_ID }]
          : callCount === 2
            ? [mockDish]
            : [mockPhoto];
      const limit = vi.fn().mockResolvedValue(rows);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    mockUpdate(mockPhoto);

    const res = await PATCH(makePatch({ sortOrder: 2 }), photoParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockPhoto);
    expect(vi.mocked(dbPool.transaction)).not.toHaveBeenCalled();
  });

  it("returns 200 and uses a transaction when isPrimary is true", async () => {
    mockSession(USER_ID);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      const rows =
        callCount === 1
          ? [{ id: COOK_ID }]
          : callCount === 2
            ? [mockDish]
            : [mockPhoto];
      const limit = vi.fn().mockResolvedValue(rows);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    mockPatchTransaction(mockPhoto);

    const res = await PATCH(makePatch({ isPrimary: true }), photoParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockPhoto);
    expect(vi.mocked(dbPool.transaction)).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// DELETE /dishes/:id/photos/:photoId
// ---------------------------------------------------------------------------

describe("DELETE /api/business/listings/dishes/[dishId]/photos/[photoId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);

    const res = await DELETE(makeDelete(), photoParams);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 404 when the dish is not found", async () => {
    mockSession(USER_ID);
    mockTwoSelects(null);

    const res = await DELETE(makeDelete(), photoParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 200 with success:true when deletion succeeds", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    } as never);

    const res = await DELETE(makeDelete(), photoParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("returns 500 when the delete throws a DB error", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockRejectedValue(new Error("DB error")),
    } as never);

    const res = await DELETE(makeDelete(), photoParams);

    expect(res.status).toBe(500);
  });
});
