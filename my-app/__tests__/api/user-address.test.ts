import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  userAddresses: {
    userId: "userId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/user/address/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

// ─── helpers ──────────────────────────────────────────────────────────────────

const USER_ID = "user-uuid-1234";

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

/** .from().where().limit() chain */
function selectLimitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** .insert().values().onConflictDoUpdate() chain */
function insertConflictChain() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue([]);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  vi.mocked(db.insert).mockReturnValue({ values } as never);
  return { values, onConflictDoUpdate };
}

const MOCK_ADDRESS_ROW = {
  id: `${USER_ID}-address`,
  userId: USER_ID,
  serviceStreet: "123 King St W",
  serviceUnit: "Apt 4",
  serviceCity: "Toronto",
  serviceProvince: "ON",
  servicePostal: "M5V 1J2",
  serviceLat: 43.6426,
  serviceLng: -79.3871,
  servicePlaceId: "mapbox-place-id-123",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const VALID_ADDRESS_BODY = {
  street: "123 King St W",
  unit: "Apt 4",
  city: "Toronto",
  province: "ON",
  postal: "M5V 1J2",
  lat: 43.6426,
  lng: -79.3871,
  placeId: "mapbox-place-id-123",
};

// ─── GET /api/user/address ────────────────────────────────────────────────────

describe("GET /api/user/address", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const res = await GET(makeReq("http://localhost/api/user/address"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/not authenticated/i);
  });

  it("returns {address: null} when no address saved", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => selectLimitChain([]));

    const res = await GET(makeReq("http://localhost/api/user/address"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.address).toBeNull();
  });

  it("returns mapped NormalizedAddress when row exists", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      selectLimitChain([MOCK_ADDRESS_ROW]),
    );

    const res = await GET(makeReq("http://localhost/api/user/address"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.address).not.toBeNull();
    expect(body.address.street).toBe("123 King St W");
    expect(body.address.unit).toBe("Apt 4");
    expect(body.address.city).toBe("Toronto");
    expect(body.address.province).toBe("ON");
    expect(body.address.postal).toBe("M5V 1J2");
    expect(body.address.lat).toBe(43.6426);
    expect(body.address.lng).toBe(-79.3871);
    expect(body.address.placeId).toBe("mapbox-place-id-123");
  });

  it("returns {address: null} when row exists but fields are null", async () => {
    mockSession(USER_ID);
    const incompleteRow = {
      id: `${USER_ID}-address`,
      userId: USER_ID,
      serviceStreet: null,
      serviceUnit: null,
      serviceCity: null,
      serviceProvince: null,
      servicePostal: null,
      serviceLat: null,
      serviceLng: null,
      servicePlaceId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(db.select).mockImplementation(() =>
      selectLimitChain([incompleteRow]),
    );

    const res = await GET(makeReq("http://localhost/api/user/address"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.address).toBeNull();
  });
});

// ─── PUT /api/user/address ────────────────────────────────────────────────────

describe("PUT /api/user/address", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const res = await PUT(
      makeReq("http://localhost/api/user/address", "PUT", VALID_ADDRESS_BODY),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/not authenticated/i);
  });

  it("returns 400 when body is missing required fields", async () => {
    mockSession(USER_ID);
    const res = await PUT(
      makeReq("http://localhost/api/user/address", "PUT", {
        street: "123 King St W",
        // missing city, province, postal, lat, lng, placeId
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when province is not 2 chars", async () => {
    mockSession(USER_ID);
    const res = await PUT(
      makeReq("http://localhost/api/user/address", "PUT", {
        ...VALID_ADDRESS_BODY,
        province: "Ontario",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when lat is not a number", async () => {
    mockSession(USER_ID);
    const res = await PUT(
      makeReq("http://localhost/api/user/address", "PUT", {
        ...VALID_ADDRESS_BODY,
        lat: "not-a-number",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts address and returns {success: true}", async () => {
    mockSession(USER_ID);
    insertConflictChain();

    const res = await PUT(
      makeReq("http://localhost/api/user/address", "PUT", VALID_ADDRESS_BODY),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(db.insert).toHaveBeenCalled();
  });

  it("upserts address without optional unit field", async () => {
    mockSession(USER_ID);
    insertConflictChain();

    const bodyWithoutUnit = { ...VALID_ADDRESS_BODY };
    // biome-ignore lint/performance/noDelete: test needs to omit unit
    delete (bodyWithoutUnit as Partial<typeof VALID_ADDRESS_BODY>).unit;

    const res = await PUT(
      makeReq("http://localhost/api/user/address", "PUT", bodyWithoutUnit),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
