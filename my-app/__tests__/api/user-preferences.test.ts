import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  userPreferences: {},
}));

import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/user/preferences/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const USER_ID = "user-uuid-1234";

function mockSession(
  userId: string | null,
  role: "client" | "cook" = "client",
) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role } } as never) : (null as never),
  );
}

function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function mockUpsertReturning(row: unknown) {
  const returning = vi.fn().mockResolvedValue([row]);
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  vi.mocked(db.insert).mockReturnValue({ values } as never);
}

describe("GET /api/user/preferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const res = await GET(
      new NextRequest("http://localhost/api/user/preferences"),
    );
    expect(res.status).toBe(401);
  });

  it("returns saved preferences for the client", async () => {
    mockSession(USER_ID);
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([{ role: "client" }]);
      return limitChain([
        {
          dietary: ["Halal"],
          allergies: ["None"],
          goals: ["Balanced"],
          whyMealPrep: ["Save time cooking"],
        },
      ]);
    });

    const res = await GET(
      new NextRequest("http://localhost/api/user/preferences"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.dietary).toEqual(["Halal"]);
    expect(body.data.allergies).toEqual(["None"]);
  });
});

describe("PATCH /api/user/preferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts preferences for the client", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ role: "client" }]),
    );
    mockUpsertReturning({
      dietary: ["Vegan"],
      allergies: [],
      goals: ["High protein"],
      whyMealPrep: ["Eat healthier"],
    });

    const res = await PATCH(
      new NextRequest("http://localhost/api/user/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dietary: ["Vegan"],
          allergies: [],
          goals: ["High protein"],
          whyMealPrep: ["Eat healthier"],
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.dietary).toEqual(["Vegan"]);
  });
});
