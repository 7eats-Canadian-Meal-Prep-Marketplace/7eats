import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  cookProfiles: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/business/profile/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { DELIVERY_MAX_KM_MAX } from "@/lib/delivery-pricing";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";

function makeGet(): NextRequest {
  return new NextRequest("http://localhost/api/business/profile", {
    method: "GET",
  });
}

function makePatch(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/business/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "cook" } } as never) : null,
  );
}

/** Mock the two-call db.select chain: first getCookId, then profile fetch */
function mockSelectTwice(profile: object | null) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // getCookId lookup
      const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      return { from } as never;
    }
    // profile fetch
    const limit = vi.fn().mockResolvedValue(profile ? [profile] : []);
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
  return { set, where, returning };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/business/profile — delivery zone fields", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns 404 when cook profile not found", async () => {
    mockSession(USER_ID);
    mockSelectTwice(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(404);
  });

  it("returns delivery zone fields when profile exists", async () => {
    mockSession(USER_ID);
    const profileRow = {
      id: COOK_ID,
      displayName: "Test Kitchen",
      delivery: "self",
      maxDeliveryKm: 10,
      deliveryRatePerKm: "1.50",
      deliveryFlatFee: "0",
      freeDeliveryAbove: "50.00",
    };
    mockSelectTwice(profileRow);

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.maxDeliveryKm).toBe(10);
    expect(body.data.deliveryRatePerKm).toBe("1.50");
    expect(body.data.deliveryFlatFee).toBe("0");
    expect(body.data.freeDeliveryAbove).toBe("50.00");
  });
});

describe("PATCH /api/business/profile — delivery zone fields", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await PATCH(
      makePatch({ maxDeliveryKm: 10, deliveryRatePerKm: 1.5 }),
    );
    expect(res.status).toBe(401);
  });

  it("updates delivery zone fields with valid data", async () => {
    mockSession(USER_ID);
    const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    vi.mocked(db.select).mockReturnValue({ from } as never);

    const updatedRow = {
      id: COOK_ID,
      maxDeliveryKm: 10,
      deliveryRatePerKm: "1.50",
      deliveryFlatFee: "0",
      freeDeliveryAbove: "50.00",
    };
    const { set } = mockUpdate(updatedRow);

    const res = await PATCH(
      makePatch({
        maxDeliveryKm: 10,
        deliveryRatePerKm: 1.5,
        freeDeliveryAbove: 50.0,
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        maxDeliveryKm: 10,
        deliveryRatePerKm: 1.5,
        deliveryFlatFee: 0,
        freeDeliveryAbove: 50.0,
      }),
    );
  });

  it(`returns 400 when maxDeliveryKm exceeds ${DELIVERY_MAX_KM_MAX}`, async () => {
    mockSession(USER_ID);
    const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    vi.mocked(db.select).mockReturnValue({ from } as never);

    const res = await PATCH(
      makePatch({ maxDeliveryKm: DELIVERY_MAX_KM_MAX + 1 }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when deliveryRatePerKm is below minimum", async () => {
    mockSession(USER_ID);
    const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    vi.mocked(db.select).mockReturnValue({ from } as never);

    const res = await PATCH(makePatch({ deliveryRatePerKm: 0.1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when deliveryFlatFee is non-zero", async () => {
    mockSession(USER_ID);
    const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    vi.mocked(db.select).mockReturnValue({ from } as never);

    const res = await PATCH(makePatch({ deliveryFlatFee: 3 }));
    expect(res.status).toBe(400);
  });

  it("allows null values to clear delivery zone fields", async () => {
    mockSession(USER_ID);
    const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    vi.mocked(db.select).mockReturnValue({ from } as never);

    const updatedRow = {
      id: COOK_ID,
      maxDeliveryKm: null,
      deliveryRatePerKm: null,
      deliveryFlatFee: null,
      freeDeliveryAbove: null,
    };
    mockUpdate(updatedRow);

    const res = await PATCH(
      makePatch({
        maxDeliveryKm: null,
        deliveryRatePerKm: null,
        deliveryFlatFee: null,
        freeDeliveryAbove: null,
      }),
    );

    expect(res.status).toBe(200);
  });
});
