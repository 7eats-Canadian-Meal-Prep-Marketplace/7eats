vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  dishes: {},
  dishTags: {},
  tags: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/business/listings/dishes/[dishId]/tags/[tagId]/route";
import { POST } from "@/app/api/business/listings/dishes/[dishId]/tags/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const DISH_ID = "dish-uuid";
const TAG_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "cook" } } as never) : null,
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

// call 1 = cookProfiles, call 2 = dish, call 3 = tags
function mockThreeSelects(dishRow: object | null, tagRow: object | null) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    let rows: object[];
    if (callCount === 1) rows = [{ id: COOK_ID }];
    else if (callCount === 2) rows = dishRow ? [dishRow] : [];
    else rows = tagRow ? [tagRow] : [];
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    return { from } as never;
  });
}

const mockDish = { id: DISH_ID };
const mockTag = { id: TAG_ID, slug: "spicy", label: "Spicy" };
const dishParams = { params: Promise.resolve({ dishId: DISH_ID }) };
const tagParams = {
  params: Promise.resolve({ dishId: DISH_ID, tagId: TAG_ID }),
};

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/tags", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeDelete(): NextRequest {
  return new NextRequest("http://localhost/tags/tag-uuid", {
    method: "DELETE",
  });
}

describe("POST /dishes/:id/tags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);

    const res = await POST(makePost({ tagId: TAG_ID }), dishParams);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 404 when dish not found", async () => {
    mockSession(USER_ID);
    mockThreeSelects(null, mockTag);

    const res = await POST(makePost({ tagId: TAG_ID }), dishParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/dish not found/i);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    const req = new NextRequest("http://localhost/tags", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, dishParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 when tagId is not a UUID", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);

    const res = await POST(makePost({ tagId: "not-a-uuid" }), dishParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 404 when tag not found", async () => {
    mockSession(USER_ID);
    mockThreeSelects(mockDish, null);

    const res = await POST(makePost({ tagId: TAG_ID }), dishParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/tag not found/i);
  });

  it("returns 201 on success", async () => {
    mockSession(USER_ID);
    mockThreeSelects(mockDish, mockTag);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);

    const res = await POST(makePost({ tagId: TAG_ID }), dishParams);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it("returns 409 on duplicate tag (code 23505)", async () => {
    mockSession(USER_ID);
    mockThreeSelects(mockDish, mockTag);
    vi.mocked(db.insert).mockReturnValue({
      values: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("duplicate"), { code: "23505" }),
        ),
    } as never);

    const res = await POST(makePost({ tagId: TAG_ID }), dishParams);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBeDefined();
  });

  it("returns 500 on unexpected DB error", async () => {
    mockSession(USER_ID);
    mockThreeSelects(mockDish, mockTag);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error("unexpected")),
    } as never);

    const res = await POST(makePost({ tagId: TAG_ID }), dishParams);

    expect(res.status).toBe(500);
  });
});

describe("DELETE /dishes/:id/tags/:tagId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);

    const res = await DELETE(makeDelete(), tagParams);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 404 when dish not found", async () => {
    mockSession(USER_ID);
    mockTwoSelects(null);

    const res = await DELETE(makeDelete(), tagParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 200 on success", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    } as never);

    const res = await DELETE(makeDelete(), tagParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("returns 500 on DB error", async () => {
    mockSession(USER_ID);
    mockTwoSelects(mockDish);
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockRejectedValue(new Error("DB error")),
    } as never);

    const res = await DELETE(makeDelete(), tagParams);

    expect(res.status).toBe(500);
  });
});
