import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { signUpEmail: vi.fn(), signInEmail: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
  dbPool: { transaction: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  authUser: {
    id: "id",
    role: "role",
    status: "status",
    firstName: "firstName",
    lastName: "lastName",
    phoneVerified: "phoneVerified",
  },
  cookApplications: { id: "id" },
  cookProfiles: {
    userId: "userId",
    applicationId: "appId",
    displayName: "displayName",
  },
  setupTokens: {
    tokenHash: "tokenHash",
    consumedAt: "consumedAt",
    expiresAt: "expiresAt",
    id: "id",
  },
}));

import { POST } from "@/app/api/setup/create-account/route";
import { db, dbPool } from "@/db";
import { auth } from "@/lib/auth";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/setup/create-account", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function authResponse(
  ok: boolean,
  status: number,
  json: unknown,
  cookies: string[] = [],
) {
  const headers = new Headers();
  (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie = () =>
    cookies;
  return { ok, status, headers, json: async () => json } as never;
}

function setupDbSelects(tokenRow: object | null, application: object | null) {
  const returning = vi.fn().mockResolvedValue(tokenRow ? [tokenRow] : []);
  const claimWhere = vi.fn(() => ({ returning }));
  const claimSet = vi.fn((_values?: { consumedAt?: Date }) => ({
    where: claimWhere,
  }));
  vi.mocked(db.update).mockReturnValue({ set: claimSet } as never);

  const limit = vi.fn().mockResolvedValue(application ? [application] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);

  return { claimSet };
}

const tokenRow = {
  id: "tok1",
  applicationId: "app1",
  tokenHash: "some-hash",
  consumedAt: null,
  expiresAt: new Date(Date.now() + 86_400_000),
};

const application = {
  id: "app1",
  contactEmail: "jane@mamas.ca",
  contactFirstName: "Jane",
  contactLastName: "Doe",
  kitchenName: "Mama's Kitchen",
};

let mockTx: {
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

function setupTransaction() {
  const whereFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });
  const valuesFn = vi.fn().mockResolvedValue(undefined);
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

  mockTx = { update: updateFn, insert: insertFn };

  vi.mocked(dbPool.transaction).mockImplementation(async (cb) => {
    return cb(mockTx as never);
  });

  return { updateFn, setFn, whereFn, insertFn, valuesFn };
}

describe("POST /api/setup/create-account", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    setupDbSelects(tokenRow, application);
    setupTransaction();

    vi.mocked(auth.api.signUpEmail).mockResolvedValue(
      authResponse(true, 200, { user: { id: "user_abc" } }),
    );
    vi.mocked(auth.api.signInEmail).mockResolvedValue(
      authResponse(true, 200, {}, ["session=abc; Path=/"]),
    );
  });

  it("returns 200 with verify-phone redirect and forwards session cookies", async () => {
    const res = await POST(
      makeRequest({ token: "valid-token", password: "secret123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.redirect).toBe("/business-auth/setup/verify-phone");
    expect(res.headers.getSetCookie()).toContain("session=abc; Path=/");
  });

  it("returns 400 when token is missing", async () => {
    const res = await POST(makeRequest({ password: "secret123" }));
    expect(res.status).toBe(400);
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
  });

  it("returns 400 when password is missing", async () => {
    const res = await POST(makeRequest({ token: "valid-token" }));
    expect(res.status).toBe(400);
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
  });

  it("returns 400 with contact-us message when token is expired or not found", async () => {
    setupDbSelects(null, application);

    const res = await POST(
      makeRequest({ token: "bad-token", password: "secret123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/expired|contact/i);
    expect(vi.mocked(auth.api.signUpEmail)).not.toHaveBeenCalled();
  });

  it("returns 400 when the associated application is not found", async () => {
    setupDbSelects(tokenRow, null);

    const res = await POST(
      makeRequest({ token: "valid-token", password: "secret123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/application not found/i);
    expect(vi.mocked(auth.api.signUpEmail)).not.toHaveBeenCalled();
  });

  it("returns 500 when Better Auth signUpEmail fails", async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue(
      authResponse(false, 500, { message: "internal error" }),
    );

    const res = await POST(
      makeRequest({ token: "valid-token", password: "secret123" }),
    );
    expect(res.status).toBe(500);
    expect(vi.mocked(dbPool.transaction)).not.toHaveBeenCalled();
  });

  it("returns 500 when signUpEmail response contains no user id", async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue(
      authResponse(true, 200, { user: {} }),
    );

    const res = await POST(
      makeRequest({ token: "valid-token", password: "secret123" }),
    );
    expect(res.status).toBe(500);
    expect(vi.mocked(dbPool.transaction)).not.toHaveBeenCalled();
  });

  it("returns 500 when the database transaction throws", async () => {
    vi.mocked(dbPool.transaction).mockRejectedValue(
      new Error("deadlock detected"),
    );

    const res = await POST(
      makeRequest({ token: "valid-token", password: "secret123" }),
    );
    expect(res.status).toBe(500);
    expect(vi.mocked(auth.api.signInEmail)).not.toHaveBeenCalled();
  });

  it("returns 200 with login redirect when signInEmail fails after account creation", async () => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue(
      authResponse(false, 401, { message: "bad credentials" }),
    );

    const res = await POST(
      makeRequest({ token: "valid-token", password: "secret123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.redirect).toBe("/business-auth/login");
    expect(vi.mocked(dbPool.transaction)).toHaveBeenCalledTimes(1);
  });

  it("consumes the setup token atomically before processing", async () => {
    const { claimSet } = setupDbSelects(tokenRow, application);
    const { updateFn } = setupTransaction();

    await POST(makeRequest({ token: "valid-token", password: "secret123" }));

    expect(claimSet).toHaveBeenCalledTimes(1);
    expect(claimSet).toHaveBeenCalledWith(
      expect.objectContaining({ consumedAt: expect.any(Date) }),
    );

    expect(updateFn.mock.calls.length).toBe(1);
  });

  it("sets role=cook and status=active on authUser inside the transaction", async () => {
    const { setFn } = setupTransaction();

    await POST(makeRequest({ token: "valid-token", password: "secret123" }));

    expect(setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "cook",
        status: "active",
        firstName: "Jane",
        lastName: "Doe",
        phoneVerified: false,
      }),
    );
  });

  it("forwards all Set-Cookie headers from Better Auth signIn onto the response", async () => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue(
      authResponse(true, 200, {}, [
        "session=tok; Path=/; HttpOnly",
        "csrf=xyz; Path=/",
      ]),
    );

    const res = await POST(
      makeRequest({ token: "valid-token", password: "secret123" }),
    );
    const setCookies = res.headers.getSetCookie();

    expect(setCookies).toContain("session=tok; Path=/; HttpOnly");
    expect(setCookies).toContain("csrf=xyz; Path=/");
  });
});
