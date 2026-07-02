import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.COOKIE_SECRET = "test-cookie-secret-guest-otp-routes";
});

const { rateLimitMock, sendOtpMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn().mockResolvedValue(true),
  sendOtpMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limit", () => ({ logAndCheckRateLimit: rateLimitMock }));
vi.mock("@/lib/emails/guest-email-otp", () => ({
  sendGuestEmailOtp: sendOtpMock,
}));

import { NextRequest } from "next/server";
import { POST as sendOtp } from "@/app/api/auth/guest-email/send-otp/route";
import { POST as verifyOtp } from "@/app/api/auth/guest-email/verify-otp/route";
import {
  buildPendingOtpCookie,
  GUEST_EMAIL_VERIFIED_COOKIE,
  GUEST_OTP_COOKIE,
  isEmailVerified,
  verifyPendingOtp,
} from "@/lib/guest/email-otp";

const EMAIL = "guest@example.com";

function post(body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (cookie) headers.cookie = cookie;
  return new NextRequest("http://localhost/api/auth/guest-email/send-otp", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

beforeEach(() => {
  rateLimitMock.mockReset().mockResolvedValue(true);
  sendOtpMock.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/auth/guest-email/send-otp", () => {
  it("rejects an invalid email", async () => {
    const res = await sendOtp(post({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    rateLimitMock.mockResolvedValue(false);
    const res = await sendOtp(post({ email: EMAIL }));
    expect(res.status).toBe(429);
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it("emails a 6-digit code and sets a matching pending cookie", async () => {
    const res = await sendOtp(post({ email: EMAIL }));
    expect(res.status).toBe(200);
    expect(sendOtpMock).toHaveBeenCalledOnce();
    const [emailArg, codeArg] = sendOtpMock.mock.calls[0];
    expect(emailArg).toBe(EMAIL);
    expect(codeArg).toMatch(/^\d{6}$/);
    const cookie = res.cookies.get(GUEST_OTP_COOKIE)?.value;
    expect(cookie).toBeTruthy();
    expect(verifyPendingOtp(cookie, EMAIL, codeArg)).toBe(true);
  });

  it("does not leak the code in the response body", async () => {
    const res = await sendOtp(post({ email: EMAIL }));
    const json = await res.json();
    const codeArg = sendOtpMock.mock.calls[0][1];
    expect(JSON.stringify(json)).not.toContain(codeArg);
  });
});

describe("POST /api/auth/guest-email/verify-otp", () => {
  it("rejects when there is no pending cookie", async () => {
    const res = await verifyOtp(post({ email: EMAIL, code: "123456" }));
    expect(res.status).toBe(400);
  });

  it("rejects a wrong code", async () => {
    const cookie = `${GUEST_OTP_COOKIE}=${buildPendingOtpCookie(EMAIL, "123456")}`;
    const res = await verifyOtp(post({ email: EMAIL, code: "000000" }, cookie));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    rateLimitMock.mockResolvedValue(false);
    const res = await verifyOtp(post({ email: EMAIL, code: "123456" }));
    expect(res.status).toBe(429);
  });

  it("verifies a correct code and sets the verified-email cookie", async () => {
    const cookie = `${GUEST_OTP_COOKIE}=${buildPendingOtpCookie(EMAIL, "123456")}`;
    const res = await verifyOtp(post({ email: EMAIL, code: "123456" }, cookie));
    expect(res.status).toBe(200);
    const verified = res.cookies.get(GUEST_EMAIL_VERIFIED_COOKIE)?.value;
    expect(isEmailVerified(verified, EMAIL)).toBe(true);
    // The pending challenge is cleared.
    expect(res.cookies.get(GUEST_OTP_COOKIE)?.value).toBe("");
  });
});
