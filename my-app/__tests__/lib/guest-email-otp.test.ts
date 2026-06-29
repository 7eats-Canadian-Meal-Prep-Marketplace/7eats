import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.COOKIE_SECRET = "test-cookie-secret-guest-otp";
});

import {
  buildPendingOtpCookie,
  buildVerifiedEmailCookie,
  generateOtpCode,
  isEmailVerified,
  normalizeEmail,
  OTP_TTL_MS,
  VERIFIED_TTL_MS,
  verifyPendingOtp,
} from "@/lib/guest/email-otp";

const EMAIL = "Guest@Example.com";
const CODE = "123456";

describe("generateOtpCode", () => {
  it("returns a 6-digit numeric string", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
});

describe("pending OTP cookie", () => {
  it("verifies the correct code for the same email", () => {
    const cookie = buildPendingOtpCookie(EMAIL, CODE);
    expect(verifyPendingOtp(cookie, EMAIL, CODE)).toBe(true);
  });

  it("is case-insensitive on the email", () => {
    const cookie = buildPendingOtpCookie(EMAIL, CODE);
    expect(verifyPendingOtp(cookie, "guest@example.com", CODE)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const cookie = buildPendingOtpCookie(EMAIL, CODE);
    expect(verifyPendingOtp(cookie, EMAIL, "000000")).toBe(false);
  });

  it("rejects the right code for a different email (code is email-bound)", () => {
    const cookie = buildPendingOtpCookie(EMAIL, CODE);
    expect(verifyPendingOtp(cookie, "someone@else.com", CODE)).toBe(false);
  });

  it("rejects an expired cookie", () => {
    const issuedAt = Date.now() - OTP_TTL_MS - 1000;
    const cookie = buildPendingOtpCookie(EMAIL, CODE, issuedAt);
    expect(verifyPendingOtp(cookie, EMAIL, CODE)).toBe(false);
  });

  it("rejects a tampered token", () => {
    const cookie = buildPendingOtpCookie(EMAIL, CODE);
    const tampered = `${cookie.slice(0, -1)}${cookie.at(-1) === "a" ? "b" : "a"}`;
    expect(verifyPendingOtp(tampered, EMAIL, CODE)).toBe(false);
  });

  it("rejects garbage input", () => {
    expect(verifyPendingOtp("", EMAIL, CODE)).toBe(false);
    expect(verifyPendingOtp("not.a.token", EMAIL, CODE)).toBe(false);
  });
});

describe("verified-email cookie", () => {
  it("confirms verification for the same email", () => {
    const cookie = buildVerifiedEmailCookie(EMAIL);
    expect(isEmailVerified(cookie, EMAIL)).toBe(true);
    expect(isEmailVerified(cookie, "guest@example.com")).toBe(true);
  });

  it("rejects a different email", () => {
    const cookie = buildVerifiedEmailCookie(EMAIL);
    expect(isEmailVerified(cookie, "other@example.com")).toBe(false);
  });

  it("rejects an expired verification", () => {
    const issuedAt = Date.now() - VERIFIED_TTL_MS - 1000;
    const cookie = buildVerifiedEmailCookie(EMAIL, issuedAt);
    expect(isEmailVerified(cookie, EMAIL)).toBe(false);
  });

  it("rejects undefined / tampered", () => {
    expect(isEmailVerified(undefined, EMAIL)).toBe(false);
    const cookie = buildVerifiedEmailCookie(EMAIL);
    expect(isEmailVerified(`x${cookie}`, EMAIL)).toBe(false);
  });
});
