import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({ db: { update: vi.fn(), insert: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  authUser: { id: "id" },
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
  whyMealPrep: ["Save time cooking", "Eat healthier"],
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/complete-onboarding", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function mockSession(id: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    id ? ({ user: { id } } as never) : null,
  );
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

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/complete-onboarding", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid", async () => {
    mockSession(USER_ID);
    const res = await POST(makeRequest({ dietary: "not-an-array" }));
    expect(res.status).toBe(400);
  });

  it("upserts preferences and marks onboarding complete", async () => {
    mockSession(USER_ID);
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

  it("rejects whyMealPrep when sent as a string", async () => {
    mockSession(USER_ID);
    const res = await POST(
      makeRequest({ ...VALID_BODY, whyMealPrep: "Save time cooking" }),
    );
    expect(res.status).toBe(400);
  });

  it("sets an httpOnly 7eats-onboarded cookie on success", async () => {
    mockSession(USER_ID);
    mockDbChain();

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("7eats-onboarded=1");
    expect(cookie).toContain("HttpOnly");
  });

  it("accepts empty arrays (all prefs optional)", async () => {
    mockSession(USER_ID);
    mockDbChain();

    const res = await POST(
      makeRequest({ dietary: [], allergies: [], goals: [], whyMealPrep: [] }),
    );
    expect(res.status).toBe(200);
  });
});
