import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verificationChecksCreate } = vi.hoisted(() => ({
  verificationChecksCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({ db: { update: vi.fn() } }));
vi.mock("@/db/schema", () => ({ authUser: { id: "id" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/cookie", () => ({ verifySignedPhone: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ logAndCheckRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    verify: {
      v2: {
        services: vi.fn(() => ({
          verificationChecks: { create: verificationChecksCreate },
        })),
      },
    },
  })),
}));

import { cookies } from "next/headers";
import { POST } from "@/app/api/auth/client/verify-otp/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { verifySignedPhone } from "@/lib/cookie";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

const USER_ID = "user-uuid";

function mockSession(id: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    id ? ({ user: { id } } as never) : null,
  );
}

function mockCookie(value: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn(() => (value ? { value } : undefined)),
  } as never);
}

function mockUpdate() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
  return { set };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/client/verify-otp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "token_test");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA_test");
  vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/auth/client/verify-otp", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(makeRequest({ code: "123456" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when code is missing", async () => {
    mockSession(USER_ID);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate-limited", async () => {
    mockSession(USER_ID);
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(false);
    const res = await POST(makeRequest({ code: "123456" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 when pending_phone cookie is absent", async () => {
    mockSession(USER_ID);
    mockCookie(undefined);
    const res = await POST(makeRequest({ code: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when cookie signature is invalid", async () => {
    mockSession(USER_ID);
    mockCookie("tampered");
    vi.mocked(verifySignedPhone).mockReturnValue(null);
    const res = await POST(makeRequest({ code: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when Twilio does not approve the code", async () => {
    mockSession(USER_ID);
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+14165550123");
    verificationChecksCreate.mockResolvedValue({ status: "pending" });
    const res = await POST(makeRequest({ code: "000000" }));
    expect(res.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 500 when Twilio throws", async () => {
    mockSession(USER_ID);
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+14165550123");
    verificationChecksCreate.mockRejectedValue(new Error("twilio down"));
    const res = await POST(makeRequest({ code: "123456" }));
    expect(res.status).toBe(500);
  });

  it("saves phone+phoneVerified, clears cookie, returns success on approved code", async () => {
    mockSession(USER_ID);
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+14165550123");
    verificationChecksCreate.mockResolvedValue({ status: "approved" });
    const { set } = mockUpdate();

    const res = await POST(makeRequest({ code: "123456" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+14165550123", phoneVerified: true }),
    );
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("pending_phone=;");
  });
});
