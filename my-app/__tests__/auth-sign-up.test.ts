import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hash", () => ({ hashIp: vi.fn(() => "hashed-ip") }));
vi.mock("@/lib/rate-limit", () => ({ logAndCheckRateLimit: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { signUpEmail: vi.fn(), sendVerificationEmail: vi.fn() } },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  authUser: {
    id: "id",
    role: "role",
    email: "email",
    emailVerified: "email_verified",
  },
}));

import { POST } from "@/app/api/auth/sign-up/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

// Wires db.select().from().where().limit() to return the given row (or []).
function setExistingAccount(account: { emailVerified: boolean } | null) {
  const limit = vi.fn().mockResolvedValue(account ? [account] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

function makeRequest(
  body: unknown,
  overrideHeaders: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/auth/sign-up", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...overrideHeaders },
  });
}

// Minimal stand-in for the Response Better Auth returns with `asResponse: true`.
function authResponse(
  ok: boolean,
  status: number,
  json: unknown,
  cookies: string[] = [],
) {
  const headers = new Headers();
  (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie = () =>
    cookies;
  // Cast away Better Auth's precise response union — the route only reads
  // `ok`, `status`, `json()`, and `headers.getSetCookie()`.
  return { ok, status, headers, json: async () => json } as never;
}

const validBody = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "Ada@Example.com",
  password: "supersecret",
};

let setSpy: ReturnType<typeof vi.fn>;
let whereSpy: ReturnType<typeof vi.fn>;

describe("POST /api/auth/sign-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
    // Default: no existing account for this email.
    setExistingAccount(null);
    whereSpy = vi.fn().mockResolvedValue(undefined);
    setSpy = vi.fn(() => ({ where: whereSpy }));
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as never);
    vi.mocked(auth.api.signUpEmail).mockResolvedValue(
      authResponse(true, 200, { user: { id: "user_123" } }),
    );
    vi.mocked(auth.api.sendVerificationEmail).mockResolvedValue(
      undefined as never,
    );
  });

  it("creates a client, sends a verification email, and starts no session", async () => {
    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    // Client is sent to the check-email page (not logged in), with the email.
    expect(body.redirect).toContain("/signup/check-email");
    expect(body.redirect).toContain(encodeURIComponent("ada@example.com"));

    // Better Auth defaults new users to `cook`; the route must override it.
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "client",
        status: "active",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    );

    // Confirmation email is requested with the post-verify callback.
    expect(vi.mocked(auth.api.sendVerificationEmail)).toHaveBeenCalledWith({
      body: {
        email: "ada@example.com",
        callbackURL: "/app-auth/onboarding",
      },
    });

    // No session cookie is issued — the client must confirm their email first.
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("normalizes the email to lowercase before creating the account", async () => {
    await POST(makeRequest(validBody));
    expect(vi.mocked(auth.api.signUpEmail)).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "ada@example.com",
          name: "Ada Lovelace",
        }),
      }),
    );
  });

  it("rate-limits on a hashed IP and skips all DB and Better Auth calls", async () => {
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(false);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(429);
    expect(vi.mocked(logAndCheckRateLimit)).toHaveBeenCalledWith(
      "signup:hashed-ip",
      expect.anything(),
    );
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
    expect(vi.mocked(auth.api.signUpEmail)).not.toHaveBeenCalled();
  });

  it("resends verification and redirects to check-email for unverified duplicate", async () => {
    setExistingAccount({ emailVerified: false });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.redirect).toContain("/signup/check-email");
    // Resent with the right callback
    expect(vi.mocked(auth.api.sendVerificationEmail)).toHaveBeenCalledWith({
      body: { email: "ada@example.com", callbackURL: "/app-auth/onboarding" },
    });
    // Never attempted to create a new account
    expect(vi.mocked(auth.api.signUpEmail)).not.toHaveBeenCalled();
  });

  it("returns 409 for a verified duplicate email", async () => {
    setExistingAccount({ emailVerified: true });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(409);
    expect(vi.mocked(auth.api.signUpEmail)).not.toHaveBeenCalled();
    expect(vi.mocked(auth.api.sendVerificationEmail)).not.toHaveBeenCalled();
  });

  it("returns 500 when Better Auth signup fails for an unexpected reason", async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue(
      authResponse(false, 500, { message: "db error" }),
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email and skips signup", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "not-valid" }));
    expect(res.status).toBe(400);
    expect(vi.mocked(auth.api.signUpEmail)).not.toHaveBeenCalled();
  });

  it("returns 400 for a too-short password", async () => {
    const res = await POST(makeRequest({ ...validBody, password: "short" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown extra fields (strict schema)", async () => {
    const res = await POST(makeRequest({ ...validBody, role: "admin" }));
    expect(res.status).toBe(400);
    expect(vi.mocked(auth.api.signUpEmail)).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-JSON body", async () => {
    const res = await POST(makeRequest("}{ not json"));
    expect(res.status).toBe(400);
  });

  it("returns 500 when Better Auth returns no user id", async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue(
      authResponse(true, 200, { user: {} }),
    );
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});
