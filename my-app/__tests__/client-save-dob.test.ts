import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({ db: { update: vi.fn(), select: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  authUser: {
    id: "id",
    role: "role",
    phoneVerified: "phone_verified",
    dateOfBirth: "date_of_birth",
    onboardingCompletedAt: "onboarding_completed_at",
  },
  authUserTable: { id: "id" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

import { POST } from "@/app/api/auth/client/save-dob/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const USER_ID = "user-123";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/client/save-dob", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function mockSession(id: string | null, role = "client") {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    id ? ({ user: { id, role } } as never) : null,
  );
}

function mockUserRow(
  row: {
    role: string;
    phoneVerified: boolean;
    dateOfBirth: string | null;
    onboardingCompletedAt: Date | null;
  } | null,
) {
  const limit = vi.fn().mockResolvedValue(row ? [row] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/client/save-dob", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(makeRequest({ dateOfBirth: "2000-01-15" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when phone is not verified", async () => {
    mockSession(USER_ID);
    mockUserRow({
      role: "client",
      phoneVerified: false,
      dateOfBirth: null,
      onboardingCompletedAt: null,
    });
    const res = await POST(makeRequest({ dateOfBirth: "2000-01-15" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when user is under 16", async () => {
    mockSession(USER_ID);
    mockUserRow({
      role: "client",
      phoneVerified: true,
      dateOfBirth: null,
      onboardingCompletedAt: null,
    });
    const res = await POST(makeRequest({ dateOfBirth: "2020-01-15" }));
    expect(res.status).toBe(400);
  });

  it("persists a valid date of birth", async () => {
    mockSession(USER_ID);
    mockUserRow({
      role: "client",
      phoneVerified: true,
      dateOfBirth: null,
      onboardingCompletedAt: null,
    });
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await POST(makeRequest({ dateOfBirth: "2000-01-15" }));
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith({ dateOfBirth: "2000-01-15" });
  });
});
