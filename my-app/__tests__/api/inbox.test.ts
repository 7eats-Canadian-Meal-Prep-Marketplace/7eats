import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
  conversations: {},
  messages: {},
  orders: {},
  listings: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  count: vi.fn().mockReturnValue({}),
  sql: Object.assign(vi.fn().mockReturnValue({}), {
    join: vi.fn().mockReturnValue({}),
  }),
}));

import { NextRequest } from "next/server";
import {
  GET as getMessages,
  POST as postMessage,
} from "@/app/api/inbox/[conversationId]/messages/route";
import { PATCH as patchRead } from "@/app/api/inbox/[conversationId]/read/route";
import { GET as getInbox } from "@/app/api/inbox/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

// ─── helpers ──────────────────────────────────────────────────────────────────

const USER_ID = "user-uuid-0001";
const CONV_ID = "c1c2c3c4-d5d6-7e8f-9a0b-c1d2e3f4a5b6";

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

function mockClientSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId
      ? ({ user: { id: userId, role: "client" } } as never)
      : (null as never),
  );
}

function mockCookSession(userId: string) {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: userId, role: "cook" },
  } as never);
}

/** .from().leftJoin()...().where().orderBy() resolves directly */
function conversationsChain(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ orderBy }));
  const leftJoin4 = vi.fn(() => ({ where }));
  const leftJoin3 = vi.fn(() => ({ leftJoin: leftJoin4 }));
  const leftJoin2 = vi.fn(() => ({ leftJoin: leftJoin3 }));
  const leftJoin1 = vi.fn(() => ({ leftJoin: leftJoin2 }));
  const from = vi.fn(() => ({ leftJoin: leftJoin1 }));
  return { from } as never;
}

/** .from().where().groupBy() resolves directly (unread count) */
function groupByChain(rows: unknown[]) {
  const groupBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ groupBy }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** .from().where() resolves directly (last message query) */
function whereChain(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** .from().where().limit() */
function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** .from().where().orderBy().limit().offset() */
function messagesChain(rows: unknown[]) {
  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** .from().where() resolves directly — used for count query in messages GET */
function countWhereChain(total: number) {
  const where = vi.fn().mockResolvedValue([{ total }]);
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

/** .update().set().where().returning() */
function updateReturningChain(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
}

// ─── GET /api/inbox ───────────────────────────────────────────────────────────

describe("GET /api/inbox", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockClientSession(null);
    const res = await getInbox(makeReq("http://localhost/api/inbox"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when user is a cook (not a client)", async () => {
    mockCookSession(USER_ID);
    const res = await getInbox(makeReq("http://localhost/api/inbox"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty array when no conversations", async () => {
    mockClientSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => conversationsChain([]));

    const res = await getInbox(makeReq("http://localhost/api/inbox"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it("returns 200 with threads when conversations exist", async () => {
    mockClientSession(USER_ID);
    const mockConv = {
      id: CONV_ID,
      cookId: "cook-uuid",
      orderId: "order-uuid",
      lastMessageAt: new Date("2026-06-01T12:00:00.000Z"),
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      cookDisplayName: "Maria G.",
      cookUserName: null,
      cookFirstName: "Maria",
      orderStatus: "pending",
      listingTitle: "Homemade Pasta",
    };

    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return conversationsChain([mockConv]);
      if (call === 2) return groupByChain([]); // unread counts
      return whereChain([]); // last messages
    });

    const res = await getInbox(makeReq("http://localhost/api/inbox"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(CONV_ID);
    expect(body.data[0].cookName).toBe("Maria G.");
  });
});

// ─── GET /api/inbox/[conversationId]/messages ─────────────────────────────────

describe("GET /api/inbox/[conversationId]/messages", () => {
  beforeEach(() => vi.clearAllMocks());

  const ctx = { params: Promise.resolve({ conversationId: CONV_ID }) };

  it("returns 401 when no session", async () => {
    mockClientSession(null);
    const res = await getMessages(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/messages`),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when client does not own the conversation", async () => {
    mockClientSession(USER_ID);
    // conversation lookup returns empty → forbidden
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await getMessages(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/messages`),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with messages when client owns conversation", async () => {
    mockClientSession(USER_ID);
    const mockMessage = {
      id: "msg-1",
      senderRole: "client",
      body: "Hello there",
      isReadByClient: true,
      isReadByCook: false,
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
    };

    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([{ id: CONV_ID }]); // owns conversation
      if (call === 2) return messagesChain([mockMessage]); // messages rows
      return countWhereChain(1); // total count
    });

    const res = await getMessages(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/messages`),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].text).toBe("Hello there");
    expect(body.meta.total).toBe(1);
  });
});

// ─── POST /api/inbox/[conversationId]/messages ────────────────────────────────

describe("POST /api/inbox/[conversationId]/messages", () => {
  beforeEach(() => vi.clearAllMocks());

  const ctx = { params: Promise.resolve({ conversationId: CONV_ID }) };

  it("returns 401 when no session", async () => {
    mockClientSession(null);
    const res = await postMessage(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/messages`, "POST", {
        text: "Hi",
      }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when client does not own the conversation", async () => {
    mockClientSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await postMessage(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/messages`, "POST", {
        text: "Hi",
      }),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when order is fulfilled (messaging closed)", async () => {
    mockClientSession(USER_ID);
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1)
        return limitChain([{ id: CONV_ID, orderId: "order-uuid" }]);
      return limitChain([{ status: "fulfilled" }]);
    });

    const res = await postMessage(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/messages`, "POST", {
        text: "Hi",
      }),
      ctx,
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/closed/i);
  });

  it("returns 201 with new message on success", async () => {
    mockClientSession(USER_ID);
    const now = new Date("2026-06-01T10:00:00.000Z");
    const newMsg = {
      id: "msg-new",
      senderRole: "client",
      body: "Hello!",
      createdAt: now,
    };

    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([{ id: CONV_ID, orderId: null }]);
      // No order status check since orderId is null
      return limitChain([]);
    });

    const returning = vi.fn().mockResolvedValue([newMsg]);
    const values = vi.fn(() => ({ returning }));
    vi.mocked(db.insert).mockReturnValue({ values } as never);
    updateReturningChain([]);

    const res = await postMessage(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/messages`, "POST", {
        text: "Hello!",
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.text).toBe("Hello!");
  });

  it("returns 400 when text is empty", async () => {
    mockClientSession(USER_ID);

    const res = await postMessage(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/messages`, "POST", {
        text: "",
      }),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/inbox/[conversationId]/read ───────────────────────────────────

describe("PATCH /api/inbox/[conversationId]/read", () => {
  beforeEach(() => vi.clearAllMocks());

  const ctx = { params: Promise.resolve({ conversationId: CONV_ID }) };

  it("returns 401 when no session", async () => {
    mockClientSession(null);
    const res = await patchRead(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/read`, "PATCH"),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when client does not own the conversation", async () => {
    mockClientSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() => limitChain([]));

    const res = await patchRead(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/read`, "PATCH"),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with markedCount on success", async () => {
    mockClientSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ id: CONV_ID }]),
    );

    const returning = vi
      .fn()
      .mockResolvedValue([{ id: "msg-1" }, { id: "msg-2" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await patchRead(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/read`, "PATCH"),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.markedCount).toBe(2);
  });

  it("returns 200 with markedCount=0 when all messages already read", async () => {
    mockClientSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ id: CONV_ID }]),
    );

    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await patchRead(
      makeReq(`http://localhost/api/inbox/${CONV_ID}/read`, "PATCH"),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.markedCount).toBe(0);
  });
});
