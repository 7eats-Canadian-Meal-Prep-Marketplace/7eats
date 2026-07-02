import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  authUserTable: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { NextRequest } from "next/server";
import {
  GET as getNotifications,
  PATCH as patchNotifications,
} from "@/app/api/user/notifications/route";
import {
  GET as getProfile,
  PATCH as patchProfile,
} from "@/app/api/user/profile/route";
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

/** .from().where().limit() */
function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** .update().set().where() resolves */
function updateWhereChain() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
  return { set, where };
}

const MOCK_USER = {
  firstName: "Alice",
  lastName: "Smith",
  phone: "+14165550123",
  phoneVerified: true,
  dateOfBirth: "1990-01-01",
  email: "alice@example.com",
  image: null,
};

const DEFAULT_NOTIF_PREFS = {
  notifs: {
    order_updates: true,
    marketing: true,
  },
  channels: { sms: true, email: true },
};

// ─── GET /api/user/profile ────────────────────────────────────────────────────

describe("GET /api/user/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockSession(null);
    const res = await getProfile(makeReq("http://localhost/api/user/profile"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with user data when authenticated", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => limitChain([MOCK_USER]));

    const res = await getProfile(makeReq("http://localhost/api/user/profile"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.firstName).toBe("Alice");
    expect(body.data.email).toBe("alice@example.com");
  });

  it("returns 404 when user not found in DB", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await getProfile(makeReq("http://localhost/api/user/profile"));
    expect(res.status).toBe(404);
  });

  it("returns 500 on db error", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("db error");
    });

    const res = await getProfile(makeReq("http://localhost/api/user/profile"));
    expect(res.status).toBe(500);
  });
});

// ─── PATCH /api/user/profile ──────────────────────────────────────────────────

describe("PATCH /api/user/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockSession(null);
    const res = await patchProfile(
      makeReq("http://localhost/api/user/profile", "PATCH", {
        firstName: "Bob",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is empty (no fields to update)", async () => {
    mockSession(USER_ID);
    const res = await patchProfile(
      makeReq("http://localhost/api/user/profile", "PATCH", {}),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no fields/i);
  });

  it("returns 400 when firstName exceeds max length", async () => {
    mockSession(USER_ID);
    const res = await patchProfile(
      makeReq("http://localhost/api/user/profile", "PATCH", {
        firstName: "A".repeat(101),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with updated user data on success", async () => {
    mockSession(USER_ID);
    updateWhereChain();
    const updatedUser = { ...MOCK_USER, firstName: "Bob" };
    vi.mocked(db.select).mockImplementation(() => limitChain([updatedUser]));

    const res = await patchProfile(
      makeReq("http://localhost/api/user/profile", "PATCH", {
        firstName: "Bob",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.firstName).toBe("Bob");
  });

  it("clears phoneVerified when the phone number changes", async () => {
    mockSession(USER_ID);
    const { set } = updateWhereChain();
    const updatedUser = { ...MOCK_USER, phone: "+14165550999" };
    vi.mocked(db.select).mockImplementation(() => limitChain([updatedUser]));

    const res = await patchProfile(
      makeReq("http://localhost/api/user/profile", "PATCH", {
        phone: "+14165550999",
      }),
    );

    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+14165550999",
        phoneVerified: false,
      }),
    );
  });

  it("returns 404 when user not found after update", async () => {
    mockSession(USER_ID);
    updateWhereChain();
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await patchProfile(
      makeReq("http://localhost/api/user/profile", "PATCH", {
        firstName: "Bob",
      }),
    );
    expect(res.status).toBe(404);
  });
});

// ─── GET /api/user/notifications ─────────────────────────────────────────────

describe("GET /api/user/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockSession(null);
    const res = await getNotifications(
      makeReq("http://localhost/api/user/notifications"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with preferences when user has custom prefs", async () => {
    mockSession(USER_ID);
    const prefs = {
      notifs: {
        order_updates: true,
        marketing: false,
      },
      channels: { sms: false, email: true },
    };
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ notificationPreferences: prefs }]),
    );

    const res = await getNotifications(
      makeReq("http://localhost/api/user/notifications"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.notifs.marketing).toBe(false);
    expect(body.data.channels.email).toBe(true);
  });

  it("returns 200 with default prefs when none saved (without persisting)", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ notificationPreferences: null }]),
    );

    const res = await getNotifications(
      makeReq("http://localhost/api/user/notifications"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject(DEFAULT_NOTIF_PREFS);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 404 when user not found", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await getNotifications(
      makeReq("http://localhost/api/user/notifications"),
    );
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/user/notifications ───────────────────────────────────────────

describe("PATCH /api/user/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockSession(null);
    const res = await patchNotifications(
      makeReq("http://localhost/api/user/notifications", "PATCH", {
        channels: { sms: false, email: true },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when both channels are disabled", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ notificationPreferences: DEFAULT_NOTIF_PREFS }]),
    );

    const res = await patchNotifications(
      makeReq("http://localhost/api/user/notifications", "PATCH", {
        channels: { sms: false, email: false },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/channel/i);
  });

  it("returns 200 with merged prefs on success", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ notificationPreferences: DEFAULT_NOTIF_PREFS }]),
    );
    updateWhereChain();

    const res = await patchNotifications(
      makeReq("http://localhost/api/user/notifications", "PATCH", {
        notifs: { marketing: true },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.notifs.marketing).toBe(true);
    // other notifs should remain unchanged
    expect(body.data.notifs.order_updates).toBe(true);
  });

  it("returns 404 when user not found", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await patchNotifications(
      makeReq("http://localhost/api/user/notifications", "PATCH", {
        channels: { email: true },
      }),
    );
    expect(res.status).toBe(404);
  });
});
