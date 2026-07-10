import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
}));

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { proxy } from "@/proxy";

const getSession = vi.mocked(auth.api.getSession);

const SECURE_SESSION_COOKIE =
  "__Secure-better-auth.session_token=prod-session-token";

function unboardedClientSession() {
  return {
    user: {
      id: "client-1",
      role: "client",
      onboardingCompletedAt: null,
    },
  };
}

function onboardedClientSession() {
  return {
    user: {
      id: "client-1",
      role: "client",
      onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

describe("proxy client auth — no login/onboarding redirect loop", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("allows onboarding when session is resolved via Better Auth (secure cookie only)", async () => {
    getSession.mockResolvedValue(unboardedClientSession());

    const req = new NextRequest("http://localhost/app-auth/onboarding", {
      headers: { cookie: SECURE_SESSION_COOKIE },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(getSession).toHaveBeenCalled();
  });

  it("sends unboarded clients from login to onboarding using the same session lookup", async () => {
    getSession.mockResolvedValue(unboardedClientSession());

    const req = new NextRequest("http://localhost/app-auth/login", {
      headers: { cookie: SECURE_SESSION_COOKIE },
    });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost/app-auth/onboarding",
    );
  });

  it("does not bounce login ↔ onboarding when only the secure session cookie is present", async () => {
    getSession.mockResolvedValue(unboardedClientSession());

    const onboardingReq = new NextRequest(
      "http://localhost/app-auth/onboarding",
      { headers: { cookie: SECURE_SESSION_COOKIE } },
    );
    const onboardingRes = await proxy(onboardingReq);

    const loginReq = new NextRequest("http://localhost/app-auth/login", {
      headers: { cookie: SECURE_SESSION_COOKIE },
    });
    const loginRes = await proxy(loginReq);

    const onboardingAgainRes = await proxy(onboardingReq);

    expect(onboardingRes.status).toBe(200);
    expect(onboardingRes.headers.get("location")).toBeNull();
    expect(loginRes.headers.get("location")).toBe(
      "http://localhost/app-auth/onboarding",
    );
    expect(onboardingAgainRes.status).toBe(200);
    expect(onboardingAgainRes.headers.get("location")).toBeNull();
  });

  it("redirects onboarding to browse when the client already completed onboarding", async () => {
    getSession.mockResolvedValue(onboardedClientSession());

    const req = new NextRequest("http://localhost/app-auth/onboarding", {
      headers: { cookie: SECURE_SESSION_COOKIE },
    });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/app/browse");
  });

  it("redirects onboarding to login only when Better Auth returns no session", async () => {
    getSession.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/app-auth/onboarding", {
      headers: { cookie: SECURE_SESSION_COOKIE },
    });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/app-auth/login");
  });
});
