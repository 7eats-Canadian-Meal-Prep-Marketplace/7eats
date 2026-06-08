import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verificationChecksCreate, verificationsCreate } = vi.hoisted(() => ({
  verificationChecksCreate: vi.fn(),
  verificationsCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { update: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  authUser: { id: "id" },
  authUserTable: { id: "id" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));
vi.mock("@/lib/cookie", () => ({
  generateSignedPhone: vi.fn(() => "signed-phone-value"),
  verifySignedPhone: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  logAndCheckRateLimit: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    verify: {
      v2: {
        services: vi.fn(() => ({
          verificationChecks: { create: verificationChecksCreate },
          verifications: { create: verificationsCreate },
        })),
      },
    },
  })),
}));

import { cookies } from "next/headers";
import { POST as sendOtp } from "@/app/api/setup/send-otp/route";
import { POST as verifyOtp } from "@/app/api/setup/verify-otp/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { generateSignedPhone, verifySignedPhone } from "@/lib/cookie";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

const USER_ID = "user-uuid";

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId } } as never) : null,
  );
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/setup/otp", {
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
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/setup/send-otp", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await sendOtp(makeRequest({ phone: "5551234567" }));
    expect(res.status).toBe(401);
    expect(verificationsCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-North-American phone number", async () => {
    mockSession(USER_ID);
    const res = await sendOtp(makeRequest({ phone: "123" }));
    expect(res.status).toBe(400);
    expect(logAndCheckRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mockSession(USER_ID);
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(false);
    const res = await sendOtp(makeRequest({ phone: "5551234567" }));
    expect(res.status).toBe(429);
    expect(verificationsCreate).not.toHaveBeenCalled();
  });

  it("returns 500 when Twilio fails to send", async () => {
    mockSession(USER_ID);
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
    verificationsCreate.mockRejectedValue(new Error("twilio down"));
    const res = await sendOtp(makeRequest({ phone: "5551234567" }));
    expect(res.status).toBe(500);
  });

  it("normalises to E.164, sends the code, and sets a signed cookie", async () => {
    mockSession(USER_ID);
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
    verificationsCreate.mockResolvedValue({ status: "pending" });

    const res = await sendOtp(makeRequest({ phone: "(555) 123-4567" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(verificationsCreate).toHaveBeenCalledWith({
      to: "+15551234567",
      channel: "sms",
    });
    expect(generateSignedPhone).toHaveBeenCalledWith("+15551234567");
    expect(res.headers.get("set-cookie")).toContain("pending_phone=");
  });
});

describe("POST /api/setup/verify-otp", () => {
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

  beforeEach(() => {
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await verifyOtp(makeRequest({ code: "123456" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when the verify rate limit is exceeded", async () => {
    mockSession(USER_ID);
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(false);
    const res = await verifyOtp(makeRequest({ code: "123456" }));
    expect(res.status).toBe(429);
    expect(verificationChecksCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when the code is missing", async () => {
    mockSession(USER_ID);
    const res = await verifyOtp(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the pending_phone cookie is absent", async () => {
    mockSession(USER_ID);
    mockCookie(undefined);
    const res = await verifyOtp(makeRequest({ code: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the cookie signature is invalid", async () => {
    mockSession(USER_ID);
    mockCookie("tampered");
    vi.mocked(verifySignedPhone).mockReturnValue(null);
    const res = await verifyOtp(makeRequest({ code: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when Twilio does not approve the code", async () => {
    mockSession(USER_ID);
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+15551234567");
    verificationChecksCreate.mockResolvedValue({ status: "pending" });
    const res = await verifyOtp(makeRequest({ code: "000000" }));
    expect(res.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 500 when the Twilio check throws", async () => {
    mockSession(USER_ID);
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+15551234567");
    verificationChecksCreate.mockRejectedValue(new Error("twilio down"));
    const res = await verifyOtp(makeRequest({ code: "123456" }));
    expect(res.status).toBe(500);
  });

  it("marks the phone verified and redirects on an approved code", async () => {
    mockSession(USER_ID);
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+15551234567");
    verificationChecksCreate.mockResolvedValue({ status: "approved" });
    const { set } = mockUpdate();

    const res = await verifyOtp(makeRequest({ code: "123456" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redirect).toContain("/business-auth/setup/onboarding");
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+15551234567", phoneVerified: true }),
    );
  });
});
