import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { readSignedPayload, signPayload } from "@/lib/cookie";

// Self-contained email OTP for guest checkout. The guest types an email; we mail
// them a 6-digit code and refuse to place the order until they prove they can
// read it. State lives in two signed, httpOnly cookies (no DB row needed):
//   - GUEST_OTP_COOKIE: the pending challenge (email + hashed code + expiry)
//   - GUEST_EMAIL_VERIFIED_COOKIE: proof a given email was verified, short-lived
// The code is bound to the email so a cookie can't be replayed against another.

export const GUEST_OTP_COOKIE = "guest_otp";
export const GUEST_EMAIL_VERIFIED_COOKIE = "guest_email_verified";

export const OTP_TTL_MS = 10 * 60_000; // code valid 10 minutes
export const VERIFIED_TTL_MS = 30 * 60_000; // verification good for 30 minutes

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// Code is hashed together with the email so the stored hash is meaningless
// against a different address.
function hashCode(code: string, email: string): string {
  return createHash("sha256")
    .update(`${code}:${normalizeEmail(email)}`)
    .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

type PendingOtp = { e: string; h: string; x: number };
type VerifiedEmail = { e: string; x: number };

export function buildPendingOtpCookie(
  email: string,
  code: string,
  now: number = Date.now(),
): string {
  const payload: PendingOtp = {
    e: normalizeEmail(email),
    h: hashCode(code, email),
    x: now + OTP_TTL_MS,
  };
  return signPayload(JSON.stringify(payload));
}

export function verifyPendingOtp(
  cookie: string | undefined,
  email: string,
  code: string,
  now: number = Date.now(),
): boolean {
  if (!cookie) return false;
  const raw = readSignedPayload(cookie);
  if (!raw) return false;
  let parsed: PendingOtp;
  try {
    parsed = JSON.parse(raw) as PendingOtp;
  } catch {
    return false;
  }
  if (!parsed || typeof parsed.x !== "number" || parsed.x < now) return false;
  if (parsed.e !== normalizeEmail(email)) return false;
  return safeEqualHex(parsed.h, hashCode(code, email));
}

export function buildVerifiedEmailCookie(
  email: string,
  now: number = Date.now(),
): string {
  const payload: VerifiedEmail = {
    e: normalizeEmail(email),
    x: now + VERIFIED_TTL_MS,
  };
  return signPayload(JSON.stringify(payload));
}

export function isEmailVerified(
  cookie: string | undefined,
  email: string,
  now: number = Date.now(),
): boolean {
  if (!cookie) return false;
  const raw = readSignedPayload(cookie);
  if (!raw) return false;
  let parsed: VerifiedEmail;
  try {
    parsed = JSON.parse(raw) as VerifiedEmail;
  } catch {
    return false;
  }
  if (!parsed || typeof parsed.x !== "number" || parsed.x < now) return false;
  return parsed.e === normalizeEmail(email);
}
