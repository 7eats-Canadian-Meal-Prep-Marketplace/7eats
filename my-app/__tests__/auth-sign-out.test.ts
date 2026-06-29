import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn(), signOut: vi.fn() } },
}));
vi.mock("@/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/db/schema", () => ({ authUser: { id: "id", role: "role" } }));

import { POST } from "@/app/api/auth/sign-out/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

function makeRequest(): Request {
  return new Request("http://localhost/api/auth/sign-out", {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
}

function signOutResponse(cookies: string[] = []) {
  const headers = new Headers();
  (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie = () =>
    cookies;
  return { headers } as never;
}

function setAccount(account: { role: string } | null) {
  const limit = vi.fn().mockResolvedValue(account ? [account] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

describe("POST /api/auth/sign-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user_123" },
    } as never);
    vi.mocked(auth.api.signOut).mockResolvedValue(signOutResponse());
    setAccount({ role: "client" });
  });

  it("redirects a client to /app/browse", async () => {
    setAccount({ role: "client" });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ redirect: "/app/browse" });
  });

  it("redirects a cook to /business-auth/login", async () => {
    setAccount({ role: "cook" });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ redirect: "/business-auth/login" });
  });

  it("redirects an admin to /business-auth/login", async () => {
    setAccount({ role: "admin" });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ redirect: "/business-auth/login" });
  });

  it("falls back to /app/browse when getSession returns null", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ redirect: "/app/browse" });
  });

  it("falls back to /app/browse when getSession throws", async () => {
    vi.mocked(auth.api.getSession).mockRejectedValue(
      new Error("session error"),
    );

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ redirect: "/app/browse" });
  });

  it("always calls signOut regardless of session or role outcome", async () => {
    await POST(makeRequest());
    expect(vi.mocked(auth.api.signOut)).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    vi.mocked(auth.api.signOut).mockResolvedValue(signOutResponse());
    vi.mocked(auth.api.getSession).mockRejectedValue(new Error("boom"));

    await POST(makeRequest());
    expect(vi.mocked(auth.api.signOut)).toHaveBeenCalledTimes(1);
  });

  it("forwards cookies from Better Auth signOut to the response", async () => {
    const cookies = ["sess=; Max-Age=0; Path=/", "token=; Max-Age=0; Path=/"];
    vi.mocked(auth.api.signOut).mockResolvedValue(signOutResponse(cookies));

    const res = await POST(makeRequest());

    const setCookieHeaders = res.headers.getSetCookie();
    expect(setCookieHeaders).toContain("sess=; Max-Age=0; Path=/");
    expect(setCookieHeaders).toContain("token=; Max-Age=0; Path=/");
  });

  it("clears the 7eats-onboarded cookie on sign-out", async () => {
    const res = await POST(makeRequest());
    const setCookieHeaders = res.headers.getSetCookie().join(";");
    expect(setCookieHeaders).toContain("7eats-onboarded=");
    expect(setCookieHeaders).toContain("Max-Age=0");
  });
});
