import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  listings: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/business/listings/[listingId]/archive/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const LISTING_ID = "listing-uuid";

const params = Promise.resolve({ listingId: LISTING_ID });

function makePost(): NextRequest {
  return new NextRequest(`http://localhost/listings/${LISTING_ID}/archive`, {
    method: "POST",
  });
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

describe("POST /api/business/listings/[listingId]/archive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(makePost(), { params });
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

    const res = await POST(makePost(), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when listing is already archived", async () => {
    mockSession(USER_ID);
    const mockListing = {
      id: LISTING_ID,
      cookId: COOK_ID,
      status: "archived",
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

    const res = await POST(makePost(), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Listing is already archived.");
  });

  it("returns 200 on successful archive", async () => {
    mockSession(USER_ID);
    const mockListing = {
      id: LISTING_ID,
      cookId: COOK_ID,
      status: "active",
    };
    const archivedListing = { ...mockListing, status: "archived" };
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
    mockUpdate(archivedListing);

    const res = await POST(makePost(), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(archivedListing);
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

    const res = await POST(makePost(), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
