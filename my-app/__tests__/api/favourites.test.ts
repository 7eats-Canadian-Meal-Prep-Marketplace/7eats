import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
  listings: {},
  savedListings: {},
  followedCooks: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

import { NextRequest } from "next/server";
import { DELETE as deleteFavCook } from "@/app/api/favourites/cooks/[cookId]/route";
import {
  GET as getFavCooks,
  POST as postFavCook,
} from "@/app/api/favourites/cooks/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

// ─── helpers ──────────────────────────────────────────────────────────────────

const USER_ID = "user-uuid-1234";
const LISTING_ID = "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6";
const COOK_ID = "b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6";

function makeReq(url: string, method = "GET", body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }
      : {}),
  });
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId
      ? ({ user: { id: userId, role: "client" } } as never)
      : (null as never),
  );
}

/** .from().innerJoin()...().where() resolves directly */
function innerJoinsWhereChain(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const innerJoin3 = vi.fn(() => ({ where }));
  const innerJoin2 = vi.fn(() => ({ innerJoin: innerJoin3 }));
  const innerJoin1 = vi.fn(() => ({ innerJoin: innerJoin2 }));
  const from = vi.fn(() => ({ innerJoin: innerJoin1 }));
  return { from } as never;
}

/** .from().innerJoin().innerJoin().where() (for favourites/cooks GET) */
function cooksFollowedChain(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const innerJoin2 = vi.fn(() => ({ where }));
  const innerJoin1 = vi.fn(() => ({ innerJoin: innerJoin2 }));
  const from = vi.fn(() => ({ innerJoin: innerJoin1 }));
  return { from } as never;
}

/** .from().where().limit() */
function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function mockInsertSuccess() {
  const values = vi.fn().mockResolvedValue([]);
  vi.mocked(db.insert).mockReturnValue({ values } as never);
}

function mockDeleteSuccess() {
  const where = vi.fn().mockResolvedValue([]);
  vi.mocked(db.delete).mockReturnValue({ where } as never);
}

// ─── GET /api/favourites/cooks ────────────────────────────────────────────────

describe("GET /api/favourites/cooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockSession(null);
    const res = await getFavCooks(
      makeReq("http://localhost/api/favourites/cooks"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with followed cooks", async () => {
    mockSession(USER_ID);
    const mockRow = {
      id: COOK_ID,
      displayName: "Maria G.",
      firstName: "Maria",
      neighborhood: "Little Italy",
      setupComplete: true,
      followedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    vi.mocked(db.select).mockImplementation(() =>
      cooksFollowedChain([mockRow]),
    );

    const res = await getFavCooks(
      makeReq("http://localhost/api/favourites/cooks"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(COOK_ID);
  });

  it("returns 200 with empty array when not following anyone", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => cooksFollowedChain([]));

    const res = await getFavCooks(
      makeReq("http://localhost/api/favourites/cooks"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

// ─── POST /api/favourites/cooks ───────────────────────────────────────────────

describe("POST /api/favourites/cooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockSession(null);
    const res = await postFavCook(
      makeReq("http://localhost/api/favourites/cooks", "POST", {
        cookId: COOK_ID,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when cookId is not a valid UUID", async () => {
    mockSession(USER_ID);
    const res = await postFavCook(
      makeReq("http://localhost/api/favourites/cooks", "POST", {
        cookId: "not-a-uuid",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when cook does not exist", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await postFavCook(
      makeReq("http://localhost/api/favourites/cooks", "POST", {
        cookId: COOK_ID,
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when already following cook", async () => {
    mockSession(USER_ID);
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([{ id: COOK_ID }]);
      return limitChain([{ id: "follow-1" }]);
    });

    const res = await postFavCook(
      makeReq("http://localhost/api/favourites/cooks", "POST", {
        cookId: COOK_ID,
      }),
    );
    expect(res.status).toBe(409);
  });

  it("returns 201 when cook is followed successfully", async () => {
    mockSession(USER_ID);
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([{ id: COOK_ID }]);
      return limitChain([]);
    });
    mockInsertSuccess();

    const res = await postFavCook(
      makeReq("http://localhost/api/favourites/cooks", "POST", {
        cookId: COOK_ID,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ─── DELETE /api/favourites/cooks/[cookId] ────────────────────────────────────

describe("DELETE /api/favourites/cooks/[cookId]", () => {
  beforeEach(() => vi.clearAllMocks());

  const ctx = { params: Promise.resolve({ cookId: COOK_ID }) };

  it("returns 401 when no session", async () => {
    mockSession(null);
    const res = await deleteFavCook(
      makeReq(`http://localhost/api/favourites/cooks/${COOK_ID}`, "DELETE"),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 on successful unfollow", async () => {
    mockSession(USER_ID);
    const where = vi.fn().mockResolvedValue([]);
    vi.mocked(db.delete).mockReturnValue({ where } as never);

    const res = await deleteFavCook(
      makeReq(`http://localhost/api/favourites/cooks/${COOK_ID}`, "DELETE"),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 200 even when not following (idempotent)", async () => {
    mockSession(USER_ID);
    const where = vi.fn().mockResolvedValue([]);
    vi.mocked(db.delete).mockReturnValue({ where } as never);

    const res = await deleteFavCook(
      makeReq(`http://localhost/api/favourites/cooks/${COOK_ID}`, "DELETE"),
      ctx,
    );
    expect(res.status).toBe(200);
  });
});
