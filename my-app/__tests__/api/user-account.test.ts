import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn(), signOut: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));

vi.mock("@/lib/client-account-deletion", () => ({
  getClientDeleteEligibility: vi.fn(),
  verifyClientPassword: vi.fn(),
  deleteClientAccount: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  logAndCheckRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/db/schema", () => ({
  authUser: { id: "id", status: "status" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { NextRequest } from "next/server";
import { DELETE, GET } from "@/app/api/user/account/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
  deleteClientAccount,
  getClientDeleteEligibility,
  verifyClientPassword,
} from "@/lib/client-account-deletion";

const USER_ID = "client-user-1";

function mockSession(role: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    role ? ({ user: { id: USER_ID, role } } as never) : (null as never),
  );
}

function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
  return { from, where, limit };
}

describe("GET /api/user/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session", async () => {
    mockSession(null);
    const res = await GET(new NextRequest("http://localhost/api/user/account"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-client roles", async () => {
    mockSession("cook");
    const res = await GET(new NextRequest("http://localhost/api/user/account"));
    expect(res.status).toBe(403);
  });

  it("returns delete eligibility for clients", async () => {
    mockSession("client");
    limitChain([{ status: "active" }]);
    vi.mocked(getClientDeleteEligibility).mockResolvedValue({
      eligible: true,
      blockingOrders: [],
    });

    const res = await GET(new NextRequest("http://localhost/api/user/account"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.eligible).toBe(true);
    expect(getClientDeleteEligibility).toHaveBeenCalledWith(USER_ID);
  });
});

describe("DELETE /api/user/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.signOut).mockResolvedValue(
      new Response(null, {
        headers: { "set-cookie": "session=; Max-Age=0" },
      }) as never,
    );
  });

  it("requires password", async () => {
    mockSession("client");
    const res = await DELETE(
      new NextRequest("http://localhost/api/user/account", {
        method: "DELETE",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects incorrect password", async () => {
    mockSession("client");
    vi.mocked(verifyClientPassword).mockResolvedValue(false);

    const res = await DELETE(
      new NextRequest("http://localhost/api/user/account", {
        method: "DELETE",
        body: JSON.stringify({ password: "wrong" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("deletes account, signs out, and returns redirect", async () => {
    mockSession("client");
    vi.mocked(verifyClientPassword).mockResolvedValue(true);
    vi.mocked(deleteClientAccount).mockResolvedValue();

    const res = await DELETE(
      new NextRequest("http://localhost/api/user/account", {
        method: "DELETE",
        body: JSON.stringify({ password: "correct" }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.redirect).toContain("deleted=1");
    expect(deleteClientAccount).toHaveBeenCalledWith(USER_ID);
    expect(auth.api.signOut).toHaveBeenCalled();
  });

  it("returns 409 when active orders block deletion", async () => {
    mockSession("client");
    vi.mocked(verifyClientPassword).mockResolvedValue(true);
    vi.mocked(deleteClientAccount).mockRejectedValue(
      new Error("ACTIVE_ORDERS"),
    );
    vi.mocked(getClientDeleteEligibility).mockResolvedValue({
      eligible: false,
      blockingOrders: [{ id: "order-1", status: "pending" }],
    });

    const res = await DELETE(
      new NextRequest("http://localhost/api/user/account", {
        method: "DELETE",
        body: JSON.stringify({ password: "correct" }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.data.blockingOrders).toHaveLength(1);
  });
});
