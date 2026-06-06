import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  listings: {},
  listingDishes: {},
  listingSubscriptionTiers: {},
  dishes: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(() => ({ as: vi.fn((alias: string) => alias) })),
}));

import { NextRequest } from "next/server";
import {
  DELETE,
  GET,
  PATCH,
} from "@/app/api/business/listings/[listingId]/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const LISTING_ID = "listing-uuid";

const params = Promise.resolve({ listingId: LISTING_ID });

function makeRequest(method: string, body?: unknown): NextRequest {
  const url = `http://localhost/listings/${LISTING_ID}`;
  if (body !== undefined) {
    return new NextRequest(url, {
      method,
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }
  return new NextRequest(url, { method });
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "cook" } } as never) : null,
  );
}

function mockUpdate(row: object) {
  const returning = vi.fn().mockResolvedValue([row]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
}

function mockDelete() {
  const where = vi.fn().mockResolvedValue([]);
  vi.mocked(db.delete).mockReturnValue({ where } as never);
}

describe("GET /api/business/listings/[listingId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when listing not found", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cookProfiles lookup
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      // listing ownership: not found
      const limit = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 with listing and dishes array", async () => {
    mockSession(USER_ID);
    const mockListing = {
      id: LISTING_ID,
      title: "Meal Plan A",
      cookId: COOK_ID,
      status: "active",
    };
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cookProfiles lookup
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      if (callCount === 2) {
        // listing ownership + stats
        const limit = vi.fn().mockResolvedValue([
          {
            listing: mockListing,
            totalOrders: 0,
            totalRevenue: "0",
          },
        ]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      if (callCount === 3) {
        // listingDishes join
        const orderBy = vi.fn().mockResolvedValue([]);
        const where = vi.fn(() => ({ orderBy }));
        const innerJoin = vi.fn(() => ({ where }));
        const from = vi.fn(() => ({ innerJoin }));
        return { from } as never;
      }
      // listingSubscriptionTiers
      const orderBy = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      ...mockListing,
      dishes: [],
      stats: { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 },
    });
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
      const limit = vi.fn().mockRejectedValue(new Error("db failure"));
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe("PATCH /api/business/listings/[listingId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await PATCH(makeRequest("PATCH", { title: "New Title" }), {
      params,
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockSession(USER_ID);
    const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    vi.mocked(db.select).mockReturnValue({ from } as never);

    const req = new NextRequest(`http://localhost/listings/${LISTING_ID}`, {
      method: "PATCH",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for empty object (no fields to update)", async () => {
    mockSession(USER_ID);
    const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    vi.mocked(db.select).mockReturnValue({ from } as never);

    const res = await PATCH(makeRequest("PATCH", {}), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No fields to update.");
  });

  it("returns 404 when listing not found", async () => {
    mockSession(USER_ID);
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cookProfiles lookup
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      // listing ownership: not found
      const limit = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await PATCH(makeRequest("PATCH", { title: "New Title" }), {
      params,
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when coverPhotoUrl is not hosted on the listings CDN", async () => {
    vi.stubEnv("R2_PUBLIC_BUCKET_URL_LISTINGS", "https://cdn.7eats.test");
    mockSession(USER_ID);
    const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    vi.mocked(db.select).mockReturnValue({ from } as never);

    const res = await PATCH(
      makeRequest("PATCH", {
        coverPhotoUrl: "https://tracker.example/pixel.png",
      }),
      { params },
    );

    expect(res.status).toBe(400);
  });

  it("returns 200 on valid patch", async () => {
    mockSession(USER_ID);
    const updatedListing = {
      id: LISTING_ID,
      title: "New Title",
      cookId: COOK_ID,
      status: "active",
    };
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cookProfiles lookup
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      // listing ownership: found
      const limit = vi.fn().mockResolvedValue([{ id: LISTING_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    mockUpdate(updatedListing);

    const res = await PATCH(makeRequest("PATCH", { title: "New Title" }), {
      params,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(updatedListing);
  });

  it("returns 500 on unexpected error", async () => {
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
      const limit = vi.fn().mockRejectedValue(new Error("db failure"));
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await PATCH(makeRequest("PATCH", { title: "New Title" }), {
      params,
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe("DELETE /api/business/listings/[listingId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await DELETE(makeRequest("DELETE"), { params });
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

    const res = await DELETE(makeRequest("DELETE"), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when status is not draft", async () => {
    mockSession(USER_ID);
    const mockListing = {
      id: LISTING_ID,
      cookId: COOK_ID,
      status: "active",
    };
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const limit = vi.fn().mockResolvedValue([mockListing]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await DELETE(makeRequest("DELETE"), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Only draft listings can be deleted.");
  });

  it("returns 200 on successful delete", async () => {
    mockSession(USER_ID);
    const mockListing = {
      id: LISTING_ID,
      cookId: COOK_ID,
      status: "draft",
    };
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        return { from } as never;
      }
      const limit = vi.fn().mockResolvedValue([mockListing]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });
    mockDelete();

    const res = await DELETE(makeRequest("DELETE"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
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
      const limit = vi.fn().mockRejectedValue(new Error("db failure"));
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    });

    const res = await DELETE(makeRequest("DELETE"), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
