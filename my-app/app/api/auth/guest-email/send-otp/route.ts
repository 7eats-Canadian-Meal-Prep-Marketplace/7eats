import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendGuestEmailOtp } from "@/lib/emails/guest-email-otp";
import {
  buildPendingOtpCookie,
  GUEST_OTP_COOKIE,
  generateOtpCode,
  normalizeEmail,
  OTP_TTL_MS,
} from "@/lib/guest-email-otp";
import { hashIp } from "@/lib/hash";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email().max(255) });

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** POST /api/auth/guest-email/send-otp — mail a guest a checkout verification code. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const ip = clientIp(req);

  // Two limits: a generous per-IP cap (abuse) and a tight per-email cap so the
  // "resend" button can't spam one inbox.
  const ipOk = await logAndCheckRateLimit(`guest-email-otp-ip:${hashIp(ip)}`, {
    windowMinutes: 15,
    maxAttempts: 15,
  });
  const emailOk = await logAndCheckRateLimit(`guest-email-otp:${email}`, {
    windowMinutes: 15,
    maxAttempts: 5,
  });
  if (!ipOk || !emailOk) {
    return NextResponse.json(
      { error: "Too many codes requested. Please wait a few minutes." },
      { status: 429 },
    );
  }

  const code = generateOtpCode();

  try {
    await sendGuestEmailOtp(email, code);
  } catch (err) {
    console.error("[guest-email/send-otp]", err);
    return NextResponse.json(
      { error: "Could not send the code. Please try again." },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(GUEST_OTP_COOKIE, buildPendingOtpCookie(email, code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: OTP_TTL_MS / 1000,
    path: "/",
  });
  return res;
}
