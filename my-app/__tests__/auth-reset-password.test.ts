import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { resetPassword: vi.fn() } },
}));

vi.mock("@/lib/rate-limit", () => ({
  logAndCheckRateLimit: vi.fn().mockResolvedValue(true),
}));

import { POST } from "@/app/api/auth/reset-password/route";
import { auth } from "@/lib/auth";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function resetResponse(ok: boolean) {
  return { ok } as never;
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.resetPassword).mockResolvedValue(resetResponse(true));
  });

  it("returns 200 { redirect: '/business-auth/login' } for business audience", async () => {
    const res = await POST(
      makeRequest({ token: "valid-token", newPassword: "SecurePass1!" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ redirect: "/business-auth/login" });
  });

  it("returns 200 { redirect: '/app-auth/login' } for client audience", async () => {
    const res = await POST(
      makeRequest({
        token: "valid-token",
        newPassword: "SecurePass1!",
        audience: "client",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ redirect: "/app-auth/login" });
  });

  it("returns 400 and skips resetPassword when token is missing", async () => {
    const res = await POST(makeRequest({ newPassword: "securepass" }));

    expect(res.status).toBe(400);
    expect(vi.mocked(auth.api.resetPassword)).not.toHaveBeenCalled();
  });

  it("returns 400 and skips resetPassword when newPassword is missing", async () => {
    const res = await POST(makeRequest({ token: "valid-token" }));

    expect(res.status).toBe(400);
    expect(vi.mocked(auth.api.resetPassword)).not.toHaveBeenCalled();
  });

  it("returns 400 and skips resetPassword when password is shorter than 8 characters", async () => {
    const res = await POST(
      makeRequest({ token: "valid-token", newPassword: "Sh0rt!" }),
    );

    expect(res.status).toBe(400);
    expect(vi.mocked(auth.api.resetPassword)).not.toHaveBeenCalled();
  });

  it("returns 400 and skips resetPassword when password lacks required character classes", async () => {
    // Long enough but no uppercase / number / special character.
    const res = await POST(
      makeRequest({ token: "valid-token", newPassword: "alllowercase" }),
    );

    expect(res.status).toBe(400);
    expect(vi.mocked(auth.api.resetPassword)).not.toHaveBeenCalled();
  });

  it("returns 400 with expiry message when Better Auth returns ok:false", async () => {
    vi.mocked(auth.api.resetPassword).mockResolvedValue(resetResponse(false));

    const res = await POST(
      makeRequest({ token: "expired-token", newPassword: "SecurePass1!" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/expired|no longer valid/i);
  });

  it("passes token and newPassword through to Better Auth correctly", async () => {
    await POST(
      makeRequest({ token: "tok-abc", newPassword: "MyPassword123!" }),
    );

    expect(vi.mocked(auth.api.resetPassword)).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { token: "tok-abc", newPassword: "MyPassword123!" },
      }),
    );
  });
});
