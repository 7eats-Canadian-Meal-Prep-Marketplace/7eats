import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  listings: {},
  listingPromotions: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));

import { NextRequest } from "next/server";
import {
  DELETE,
  PATCH,
} from "@/app/api/business/listings/[listingId]/promotions/[promotionId]/route";
import { PATCH as TOGGLE } from "@/app/api/business/listings/[listingId]/promotions/[promotionId]/toggle/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const LISTING_ID = "listing-uuid";
const PROMO_ID = "promo-uuid";
const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";

const params = Promise.resolve({
  listingId: LISTING_ID,
  promotionId: PROMO_ID,
});

function makePatch(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/listings/${LISTING_ID}/promotions/${PROMO_ID}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    },
  );
}

function makeDelete(): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/listings/${LISTING_ID}/promotions/${PROMO_ID}`,
    { method: "DELETE" },
  );
}

function makeToggle(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/listings/${LISTING_ID}/promotions/${PROMO_ID}/toggle`,
    {
      method: "PATCH",
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

function mockUpdate(row: object) {
  const returning = vi.fn().mockResolvedValue([row]);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
}

function mockSelectThreeCalls(
  cookResult: object | null,
  listingResult: object | null,
  promoResult: object | null,
) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      const limit = vi.fn().mockResolvedValue(cookResult ? [cookResult] : []);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    }
    if (callCount === 2) {
      const limit = vi
        .fn()
        .mockResolvedValue(listingResult ? [listingResult] : []);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    }
    const limit = vi.fn().mockResolvedValue(promoResult ? [promoResult] : []);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    return { from } as never;
  });
}

describe("PATCH /api/business/listings/[listingId]/promotions/[promotionId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await PATCH(makePatch({ isActive: false }), { params });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for invalid JSON", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, { id: PROMO_ID });
    const req = new NextRequest(
      `http://localhost/api/business/listings/${LISTING_ID}/promotions/${PROMO_ID}`,
      {
        method: "PATCH",
        body: "not-json",
        headers: { "content-type": "application/json" },
      },
    );
    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for empty object", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, { id: PROMO_ID });
    const res = await PATCH(makePatch({}), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No fields to update.");
  });

  it("returns 404 when listing not found", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, null, { id: PROMO_ID });
    const res = await PATCH(makePatch({ isActive: false }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when promotion not found", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, null);
    const res = await PATCH(makePatch({ isActive: false }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 on valid update", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, { id: PROMO_ID });
    const updated = { id: PROMO_ID, listingId: LISTING_ID, isActive: false };
    mockUpdate(updated);

    const res = await PATCH(makePatch({ isActive: false }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(updated);
  });

  it("returns 500 on db error", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, { id: PROMO_ID });
    const returning = vi.fn().mockRejectedValue(new Error("db failure"));
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makePatch({ isActive: false }), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe("DELETE /api/business/listings/[listingId]/promotions/[promotionId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when listing not found", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, null, { id: PROMO_ID });
    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when promotion not found", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, null);
    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 on successful delete", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, { id: PROMO_ID });
    const where = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where } as never);

    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 on db error", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, { id: PROMO_ID });
    const where = vi.fn().mockRejectedValue(new Error("db failure"));
    vi.mocked(db.delete).mockReturnValue({ where } as never);

    const res = await DELETE(makeDelete(), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe("PATCH /api/business/listings/[listingId]/promotions/[promotionId]/toggle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await TOGGLE(makeToggle({ isActive: false }), { params });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when isActive is missing from body", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, { id: PROMO_ID });
    const res = await TOGGLE(makeToggle({}), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when listing not found", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, null, { id: PROMO_ID });
    const res = await TOGGLE(makeToggle({ isActive: false }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when promotion not found", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, null);
    const res = await TOGGLE(makeToggle({ isActive: false }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 on toggle to false", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, { id: PROMO_ID });
    const updated = { id: PROMO_ID, listingId: LISTING_ID, isActive: false };
    mockUpdate(updated);

    const res = await TOGGLE(makeToggle({ isActive: false }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(updated);
  });

  it("returns 200 on toggle to true", async () => {
    mockSession(USER_ID);
    mockSelectThreeCalls({ id: COOK_ID }, { id: LISTING_ID }, { id: PROMO_ID });
    const updated = { id: PROMO_ID, listingId: LISTING_ID, isActive: true };
    mockUpdate(updated);

    const res = await TOGGLE(makeToggle({ isActive: true }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(updated);
  });
});
