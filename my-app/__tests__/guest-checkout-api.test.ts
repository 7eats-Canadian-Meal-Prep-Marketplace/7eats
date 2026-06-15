import { describe, expect, it, vi } from "vitest";
import { haversineKm } from "@/lib/haversine";

// Mock the rate-limit module so validation tests never touch the DB.
vi.mock("@/lib/rate-limit", () => ({
  logAndCheckRateLimit: vi.fn().mockResolvedValue(true),
}));

// Mock the DB so the route never opens a Neon connection.
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/db/schema", () => ({
  authUser: {
    id: "id",
    email: "email",
    isGuestAccount: "is_guest_account",
  },
  authUserTable: {},
  legalAcceptances: {},
}));

// Mock Better Auth so sign-up/sign-in calls don't fire.
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      signInEmail: vi.fn(),
    },
  },
}));

// Mock the guest activation email helper.
vi.mock("@/lib/emails/guest-checkout", () => ({
  sendGuestActivationEmail: vi.fn(),
}));

// Mock hash utility used by rate-limit key construction.
vi.mock("@/lib/hash", () => ({
  hashIp: vi.fn((ip: string) => ip),
}));

describe("POST /api/auth/guest-checkout — validation (no DB)", () => {
  it("returns 400 when email is missing", async () => {
    const { POST } = await import("@/app/api/auth/guest-checkout/route");
    const req = new Request("http://localhost/api/auth/guest-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        phone: "6471234567",
        acceptedTerms: true,
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when phone is missing", async () => {
    const { POST } = await import("@/app/api/auth/guest-checkout/route");
    const req = new Request("http://localhost/api/auth/guest-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        acceptedTerms: true,
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when firstName is missing", async () => {
    const { POST } = await import("@/app/api/auth/guest-checkout/route");
    const req = new Request("http://localhost/api/auth/guest-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastName: "Doe",
        email: "jane@example.com",
        phone: "6471234567",
        acceptedTerms: true,
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });
});

describe("service-area distance logic (haversine)", () => {
  it("correctly classifies an in-range address (~5 km)", () => {
    // Cook at Toronto City Hall, customer ~5 km away — max delivery 10 km
    const dist = haversineKm(43.6532, -79.3832, 43.6888, -79.33);
    expect(dist).toBeLessThan(10);
  });

  it("correctly classifies an out-of-range address (~40 km)", () => {
    // Cook at Toronto City Hall, customer in Brampton (~40 km)
    const dist = haversineKm(43.6532, -79.3832, 43.7315, -79.7624);
    expect(dist).toBeGreaterThan(30);
  });

  it("returns 0 for same location", () => {
    const dist = haversineKm(43.6532, -79.3832, 43.6532, -79.3832);
    expect(dist).toBe(0);
  });
});
