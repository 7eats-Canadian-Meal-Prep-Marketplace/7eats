import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({
  db: { update: vi.fn(), insert: vi.fn(), select: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  authUser: {
    id: "id",
    role: "role",
    phoneVerified: "phone_verified",
    dateOfBirth: "date_of_birth",
    onboardingCompletedAt: "onboarding_completed_at",
  },
  authUserTable: { id: "id" },
  userPreferences: { userId: "user_id" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

import { POST } from "@/app/api/auth/complete-onboarding/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const USER_ID = "user-123";
const VALID_BODY = {
  dietary: ["Halal", "Vegan"],
  allergies: ["Peanuts"],
  goals: ["High protein"],
  whyMealPrep: ["Save time cooking"],
  dateOfBirth: "2000-01-15",
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/complete-onboarding", {
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

function mockDbChain() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  vi.mocked(db.insert).mockReturnValue({ values } as never);

  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);

  return { values, set, onConflictDoUpdate };
}

const READY_USER = {
  role: "client",
  phoneVerified: true,
  dateOfBirth: "2000-01-15",
  onboardingCompletedAt: null as Date | null,
};

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/complete-onboarding", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-client accounts", async () => {
    mockSession(USER_ID, "cook");
    mockUserRow({
      role: "cook",
      phoneVerified: true,
      dateOfBirth: "2000-01-15",
      onboardingCompletedAt: null,
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 403 when phone is not verified on first completion", async () => {
    mockSession(USER_ID);
    mockUserRow({
      ...READY_USER,
      phoneVerified: false,
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 400 when date of birth is missing on first completion", async () => {
    mockSession(USER_ID);
    mockUserRow({
      ...READY_USER,
      dateOfBirth: null,
    });
    const { dateOfBirth: _, ...body } = VALID_BODY;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when date of birth fails the 16+ rule", async () => {
    mockSession(USER_ID);
    mockUserRow({
      ...READY_USER,
      dateOfBirth: null,
    });
    const res = await POST(
      makeRequest({ ...VALID_BODY, dateOfBirth: "2020-01-15" }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts preferences and marks onboarding complete", async () => {
    mockSession(USER_ID);
    mockUserRow(READY_USER);
    const { values, set, onConflictDoUpdate } = mockDbChain();

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(values).toHaveBeenCalledWith({
      userId: USER_ID,
      dietary: VALID_BODY.dietary,
      allergies: VALID_BODY.allergies,
      goals: VALID_BODY.goals,
      whyMealPrep: VALID_BODY.whyMealPrep,
    });
    expect(onConflictDoUpdate).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ onboardingCompletedAt: expect.any(Date) }),
    );
  });

  it("sets an httpOnly 7eats-onboarded cookie on success", async () => {
    mockSession(USER_ID);
    mockUserRow(READY_USER);
    mockDbChain();

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("7eats-onboarded=1");
    expect(cookie).toContain("HttpOnly");
  });

  it("accepts empty preference arrays on first completion", async () => {
    mockSession(USER_ID);
    mockUserRow(READY_USER);
    mockDbChain();

    const res = await POST(
      makeRequest({
        dietary: [],
        allergies: [],
        goals: [],
        whyMealPrep: [],
        dateOfBirth: "2000-01-15",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("allows preference updates after onboarding is complete", async () => {
    mockSession(USER_ID);
    mockUserRow({
      ...READY_USER,
      onboardingCompletedAt: new Date("2024-01-01"),
    });
    mockDbChain();

    const res = await POST(
      makeRequest({
        dietary: ["Vegan"],
        allergies: [],
        goals: [],
        whyMealPrep: [],
      }),
    );
    expect(res.status).toBe(200);
  });
});
