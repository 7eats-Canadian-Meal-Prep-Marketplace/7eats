import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hash", () => ({ hashIp: vi.fn(() => "hashed-ip") }));
vi.mock("@/lib/rate-limit", () => ({ logAndCheckRateLimit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { signInEmail: vi.fn() } } }));
vi.mock("@/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  authUser: { email: "email", role: "role", emailVerified: "email_verified" },
}));

import { POST } from "@/app/api/auth/sign-in/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/sign-in", {
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

// Wires up the db.select(...).from(...).where(...).limit(1) chain to resolve to
// the given account row (or an empty result when null).
function setAccount(
  account: {
    role: string;
    emailVerified: boolean;
    onboardingCompletedAt?: Date | null;
  } | null,
) {
  const limit = vi.fn().mockResolvedValue(account ? [account] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

const creds = { email: "Ada@Example.com", password: "supersecret" };

describe("POST /api/auth/sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
    vi.mocked(auth.api.signInEmail).mockResolvedValue(
      authResponse(true, 200, { user: { id: "u" } }, ["sess=1; Path=/"]),
    );
    setAccount({ role: "client", emailVerified: true });
  });

  it("blocks an unverified client with 403 and never attempts sign-in", async () => {
    setAccount({ role: "client", emailVerified: false });

    const res = await POST(makeRequest(creds));

    expect(res.status).toBe(403);
    expect(vi.mocked(auth.api.signInEmail)).not.toHaveBeenCalled();
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("signs in a verified client and redirects to browse", async () => {
    setAccount({ role: "client", emailVerified: true });

    const res = await POST(makeRequest(creds));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ redirect: "/app/browse" });
    expect(res.headers.getSetCookie()).toContain("sess=1; Path=/");
  });

  it("does NOT gate cooks on email verification (redirects to dashboard)", async () => {
    setAccount({ role: "cook", emailVerified: false });

    const res = await POST(makeRequest(creds));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ redirect: "/business/dashboard" });
    expect(vi.mocked(auth.api.signInEmail)).toHaveBeenCalledTimes(1);
  });

  it("rejects a cook signing in on the client portal", async () => {
    setAccount({ role: "cook", emailVerified: true });

    const res = await POST(makeRequest({ ...creds, audience: "client" }));

    expect(res.status).toBe(403);
    expect(vi.mocked(auth.api.signInEmail)).not.toHaveBeenCalled();
  });

  it("rejects a client signing in on the business portal", async () => {
    setAccount({ role: "client", emailVerified: true });

    const res = await POST(makeRequest({ ...creds, audience: "business" }));

    expect(res.status).toBe(403);
    expect(vi.mocked(auth.api.signInEmail)).not.toHaveBeenCalled();
  });

  it("returns 401 on wrong credentials", async () => {
    setAccount({ role: "client", emailVerified: true });
    vi.mocked(auth.api.signInEmail).mockResolvedValue(
      authResponse(false, 401, { message: "bad" }),
    );

    const res = await POST(makeRequest(creds));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited, before any DB or sign-in call", async () => {
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(false);

    const res = await POST(makeRequest(creds));

    expect(res.status).toBe(429);
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
    expect(vi.mocked(auth.api.signInEmail)).not.toHaveBeenCalled();
  });

  it("returns 400 when email or password is missing", async () => {
    const res = await POST(makeRequest({ email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("sets 7eats-onboarded cookie when client has completed onboarding", async () => {
    setAccount({
      role: "client",
      emailVerified: true,
      onboardingCompletedAt: new Date(),
    });
    const res = await POST(makeRequest({ ...creds, audience: "client" }));
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie().join(";");
    expect(cookies).toContain("7eats-onboarded=1");
  });

  it("does not set 7eats-onboarded cookie when onboarding is incomplete", async () => {
    setAccount({
      role: "client",
      emailVerified: true,
      onboardingCompletedAt: null,
    });
    const res = await POST(makeRequest({ ...creds, audience: "client" }));
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie().join(";");
    expect(cookies).not.toContain("7eats-onboarded=1");
  });
});
