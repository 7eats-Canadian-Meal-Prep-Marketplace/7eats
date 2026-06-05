import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  orders: {},
  conversations: {},
  cookProfiles: {},
  userPreferences: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/business/clients/[clientId]/preferences/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const CLIENT_ID = "client-text-id";

const params = Promise.resolve({ clientId: CLIENT_ID });

function makeGet(clientId = CLIENT_ID): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/clients/${clientId}/preferences`,
  );
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "cook" } } as never) : null,
  );
}

// Every query in the route is a `.from().where().limit()` chain that resolves to
// an array. The call order is: (1) cook lookup inside getCookId, (2) order link,
// (3) conversation link, (4) preferences row.
function chain(result: unknown[]) {
  const limit = vi.fn().mockResolvedValue(result);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function mockSelects(results: unknown[][]) {
  let i = 0;
  vi.mocked(db.select).mockImplementation(() => chain(results[i++] ?? []));
}

const PREFS_ROW = {
  dietary: ["Halal", "Nut-free"],
  allergies: ["Peanuts"],
  goals: ["High protein", "Muscle gain"],
  whyMealPrep: ["Save time cooking"],
};

describe("GET /api/business/clients/[clientId]/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession(USER_ID);
  });

  it("returns 401 when there is no cook session", async () => {
    mockSession(null);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the cook has no order or conversation with the client", async () => {
    // cook found, but no order link and no conversation link
    mockSelects([[{ id: COOK_ID }], [], []]);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(403);
  });

  it("returns the client's preferences when linked via an order", async () => {
    mockSelects([[{ id: COOK_ID }], [{ id: "order-1" }], [], [PREFS_ROW]]);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual({
      dietary: PREFS_ROW.dietary,
      allergies: PREFS_ROW.allergies,
      goals: PREFS_ROW.goals,
      whyMealPrep: PREFS_ROW.whyMealPrep,
      hasPreferences: true,
    });
  });

  it("returns the client's preferences when linked only via a conversation", async () => {
    mockSelects([[{ id: COOK_ID }], [], [{ id: "conv-1" }], [PREFS_ROW]]);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.hasPreferences).toBe(true);
    expect(json.data.allergies).toEqual(["Peanuts"]);
  });

  it("returns an empty state when linked but the client has no preferences row", async () => {
    mockSelects([[{ id: COOK_ID }], [{ id: "order-1" }], [], []]);
    const res = await GET(makeGet(), { params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual({
      dietary: [],
      allergies: [],
      goals: [],
      whyMealPrep: [],
      hasPreferences: false,
    });
  });
});
