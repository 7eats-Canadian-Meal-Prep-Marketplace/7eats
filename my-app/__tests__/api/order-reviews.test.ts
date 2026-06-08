import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  orders: {},
  reviews: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

import { NextRequest } from "next/server";
import {
  DELETE as deleteReview,
  PATCH as patchReview,
  POST as postReview,
} from "@/app/api/orders/[orderId]/reviews/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

// ─── helpers ──────────────────────────────────────────────────────────────────

const USER_ID = "user-uuid-1234";
const OTHER_USER_ID = "other-user-9999";
const ORDER_ID = "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6";
const REVIEW_ID = "r1r2r3r4-s5s6-7t8u-9v0w-x1y2z3a4b5c6";

function makeReq(url: string, method = "POST", body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined
      ? {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }
      : {}),
  });
}

function mockSession(
  userId: string | null,
  role: "client" | "cook" = "client",
) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role } } as never) : (null as never),
  );
}

/** .from().where().limit() */
function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** db.insert().values().returning() */
function mockInsertReturning(row: unknown) {
  const returning = vi.fn().mockResolvedValue([row]);
  const values = vi.fn(() => ({ returning }));
  vi.mocked(db.insert).mockReturnValue({ values } as never);
}

/** db.update().set().where().returning() */
function mockUpdateReturning(row: unknown) {
  const returning = vi.fn().mockResolvedValue([row]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
}

/** db.delete().where() */
function mockDeleteWhere() {
  const where = vi.fn().mockResolvedValue([]);
  vi.mocked(db.delete).mockReturnValue({ where } as never);
}

const FULFILLED_ORDER = {
  id: ORDER_ID,
  clientId: USER_ID,
  cookId: "cook-uuid",
  listingId: "listing-uuid",
  status: "fulfilled",
};

const PENDING_ORDER = {
  ...FULFILLED_ORDER,
  status: "pending",
};

const MOCK_REVIEW = {
  id: REVIEW_ID,
  orderId: ORDER_ID,
  clientId: USER_ID,
  cookId: "cook-uuid",
  listingId: "listing-uuid",
  rating: 5,
  comment: "Excellent!",
  isVisible: true,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

const ctx = { params: Promise.resolve({ orderId: ORDER_ID }) };

// ─── POST /api/orders/[orderId]/reviews ───────────────────────────────────────

describe("POST /api/orders/[orderId]/reviews", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockSession(null);
    const res = await postReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "POST", {
        rating: 5,
      }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is a cook (not a client)", async () => {
    mockSession(USER_ID, "cook");
    const res = await postReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "POST", {
        rating: 5,
      }),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when rating is out of range", async () => {
    mockSession(USER_ID);
    const res = await postReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "POST", {
        rating: 6,
      }),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when rating is missing", async () => {
    mockSession(USER_ID);
    const res = await postReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "POST", {
        comment: "Great!",
      }),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when order not found or does not belong to user", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await postReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "POST", {
        rating: 5,
      }),
      ctx,
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when order is not fulfilled", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => limitChain([PENDING_ORDER]));

    const res = await postReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "POST", {
        rating: 5,
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/fulfilled/i);
  });

  it("returns 409 when review already exists for the order", async () => {
    mockSession(USER_ID);
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([FULFILLED_ORDER]);
      return limitChain([{ id: REVIEW_ID }]); // existing review
    });

    const res = await postReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "POST", {
        rating: 5,
      }),
      ctx,
    );
    expect(res.status).toBe(409);
  });

  it("returns 201 with review data on success", async () => {
    mockSession(USER_ID);
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([FULFILLED_ORDER]);
      return limitChain([]); // no existing review
    });
    mockInsertReturning(MOCK_REVIEW);

    const res = await postReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "POST", {
        rating: 5,
        comment: "Excellent!",
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.rating).toBe(5);
  });
});

// ─── PATCH /api/orders/[orderId]/reviews ──────────────────────────────────────

describe("PATCH /api/orders/[orderId]/reviews", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockSession(null);
    const res = await patchReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "PATCH", {
        rating: 4,
      }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when body has no fields", async () => {
    mockSession(USER_ID);
    const res = await patchReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "PATCH", {}),
      ctx,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no fields/i);
  });

  it("returns 404 when review not found", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await patchReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "PATCH", {
        rating: 4,
      }),
      ctx,
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when review belongs to another user", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ id: REVIEW_ID, clientId: OTHER_USER_ID }]),
    );

    const res = await patchReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "PATCH", {
        rating: 4,
      }),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with updated review on success", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ id: REVIEW_ID, clientId: USER_ID }]),
    );
    mockUpdateReturning({ ...MOCK_REVIEW, rating: 4 });

    const res = await patchReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "PATCH", {
        rating: 4,
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.rating).toBe(4);
  });
});

// ─── DELETE /api/orders/[orderId]/reviews ─────────────────────────────────────

describe("DELETE /api/orders/[orderId]/reviews", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockSession(null);
    const res = await deleteReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "DELETE"),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when review not found", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await deleteReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "DELETE"),
      ctx,
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when review belongs to another user", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ id: REVIEW_ID, clientId: OTHER_USER_ID }]),
    );

    const res = await deleteReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "DELETE"),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 on successful delete", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ id: REVIEW_ID, clientId: USER_ID }]),
    );
    mockDeleteWhere();

    const res = await deleteReview(
      makeReq(`http://localhost/api/orders/${ORDER_ID}/reviews`, "DELETE"),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
