import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hash", () => ({ hashIp: vi.fn(() => "hashed-ip") }));
vi.mock("@/lib/rate-limit", () => ({ logAndCheckRateLimit: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { requestPasswordReset: vi.fn() } },
}));

import { POST } from "@/app/api/auth/forgot-password/route";
import { auth } from "@/lib/auth";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

function makeRequest(
  body: unknown,
  overrideHeaders: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...overrideHeaders },
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
    vi.mocked(auth.api.requestPasswordReset).mockResolvedValue(
      undefined as never,
    );
  });

  it("returns 200 { success: true } for a valid email", async () => {
    const res = await POST(makeRequest({ email: "user@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("normalizes email to lowercase before calling Better Auth", async () => {
    await POST(makeRequest({ email: "User@Example.COM" }));

    expect(vi.mocked(auth.api.requestPasswordReset)).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: "user@example.com" }),
      }),
    );
  });

  it("returns 400 and skips requestPasswordReset when email is missing", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(vi.mocked(auth.api.requestPasswordReset)).not.toHaveBeenCalled();
  });

  it("returns 429 and skips requestPasswordReset when rate limited", async () => {
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(false);

    const res = await POST(makeRequest({ email: "user@example.com" }));

    expect(res.status).toBe(429);
    expect(vi.mocked(auth.api.requestPasswordReset)).not.toHaveBeenCalled();
  });

  it("uses a hashed IP in the rate-limit key", async () => {
    await POST(makeRequest({ email: "user@example.com" }));

    expect(vi.mocked(logAndCheckRateLimit)).toHaveBeenCalledWith(
      "forgot-password:hashed-ip",
      expect.anything(),
    );
  });

  it("still returns 200 when Better Auth throws (email enumeration prevention)", async () => {
    vi.mocked(auth.api.requestPasswordReset).mockRejectedValue(
      new Error("no such user"),
    );

    const res = await POST(makeRequest({ email: "ghost@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("passes a redirectTo that includes /business-auth/reset-password", async () => {
    await POST(makeRequest({ email: "user@example.com" }));

    expect(vi.mocked(auth.api.requestPasswordReset)).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          redirectTo: expect.stringContaining("/business-auth/reset-password"),
        }),
      }),
    );
  });
});
