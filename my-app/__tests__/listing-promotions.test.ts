import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  listings: {},
  listingPromotions: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), asc: vi.fn() }));

import { NextRequest } from "next/server";
import {
  GET,
  POST,
} from "@/app/api/business/listings/[listingId]/promotions/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const LISTING_ID = "listing-uuid";

const params = Promise.resolve({ listingId: LISTING_ID });

function makeGet(): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/listings/${LISTING_ID}/promotions`,
    { method: "GET" },
  );
}

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/listings/${LISTING_ID}/promotions`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    },
  );
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "cook" } } as never) : null,
  );
}

function mockInsert(row: object) {
  const returning = vi.fn().mockResolvedValue([row]);
  const values = vi.fn(() => ({ returning }));
  vi.mocked(db.insert).mockReturnValue({ values } as never);
}

describe("GET /api/business/listings/[listingId]/promotions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 401 when no cook profile", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const limit = vi.fn().mockResolvedValue([]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when listing not found", async () => {
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
      const limit = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 200 with empty array when no promotions", async () => {
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
      if (callCount === 2) {
        const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const orderBy = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it("returns 200 with promotion rows", async () => {
    mockSession(USER_ID);
    const mockPromotions = [
      {
        id: "promo-1",
        listingId: LISTING_ID,
        type: "percentage_off",
        value: "10.00",
      },
      {
        id: "promo-2",
        listingId: LISTING_ID,
        type: "fixed_off",
        value: "5.00",
      },
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
      if (callCount === 2) {
        const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const orderBy = vi.fn().mockResolvedValue(mockPromotions);
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockPromotions);
  });

  it("returns 500 on db error", async () => {
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
      if (callCount === 2) {
        const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const orderBy = vi.fn().mockRejectedValue(new Error("db failure"));
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe("POST /api/business/listings/[listingId]/promotions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(makePost({ type: "percentage_off", value: 20 }), {
      params,
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
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
      const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const req = new NextRequest(
      `http://localhost/api/business/listings/${LISTING_ID}/promotions`,
      {
        method: "POST",
        body: "not-json",
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when type is missing", async () => {
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
      const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await POST(makePost({ value: 20 }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for percentage_off missing value", async () => {
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
      const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await POST(makePost({ type: "percentage_off" }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for percentage_off value > 100", async () => {
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
      const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await POST(makePost({ type: "percentage_off", value: 150 }), {
      params,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for buy_x_get_y missing buyQty", async () => {
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
      const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await POST(makePost({ type: "buy_x_get_y", getQty: 1 }), {
      params,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when validUntil is before validFrom", async () => {
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
      const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await POST(
      makePost({
        type: "percentage_off",
        value: 20,
        validFrom: "2025-12-31T00:00:00.000Z",
        validUntil: "2025-01-01T00:00:00.000Z",
      }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when listing not found", async () => {
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
      const limit = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const res = await POST(makePost({ type: "percentage_off", value: 20 }), {
      params,
    });
    expect(res.status).toBe(404);
  });

  it("returns 201 on valid percentage_off body", async () => {
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
      const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const inserted = {
      id: "promo-1",
      listingId: LISTING_ID,
      type: "percentage_off",
      value: "20.00",
    };
    mockInsert(inserted);

    const res = await POST(makePost({ type: "percentage_off", value: 20 }), {
      params,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(inserted);
  });

  it("returns 201 on valid buy_x_get_y body", async () => {
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
      const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const inserted = {
      id: "promo-2",
      listingId: LISTING_ID,
      type: "buy_x_get_y",
      buyQty: 2,
      getQty: 1,
    };
    mockInsert(inserted);

    const res = await POST(
      makePost({ type: "buy_x_get_y", buyQty: 2, getQty: 1 }),
      { params },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(inserted);
  });

  it("returns 500 on db error", async () => {
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
      const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    const returning = vi.fn().mockRejectedValue(new Error("db failure"));
    const values = vi.fn(() => ({ returning }));
    vi.mocked(db.insert).mockReturnValue({ values } as never);

    const res = await POST(makePost({ type: "percentage_off", value: 20 }), {
      params,
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
