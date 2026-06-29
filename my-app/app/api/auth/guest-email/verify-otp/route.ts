import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildVerifiedEmailCookie,
  GUEST_EMAIL_VERIFIED_COOKIE,
  GUEST_OTP_COOKIE,
  normalizeEmail,
  VERIFIED_TTL_MS,
  verifyPendingOtp,
} from "@/lib/guest-email-otp";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email().max(255),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code."),
});

/** POST /api/auth/guest-email/verify-otp — check the code, issue a verified-email cookie. */
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
      { error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code." },
      { status: 400 },
    );
  }

  const email = normalizeEmail(parsed.data.email);

  const allowed = await logAndCheckRateLimit(`guest-email-verify:${email}`, {
    windowMinutes: 15,
    maxAttempts: 6,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 },
    );
  }

  const pending = req.cookies.get(GUEST_OTP_COOKIE)?.value;
  if (!verifyPendingOtp(pending, email, parsed.data.code)) {
    return NextResponse.json(
      { error: "That code is incorrect or expired. Request a new one." },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(
    GUEST_EMAIL_VERIFIED_COOKIE,
    buildVerifiedEmailCookie(email),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: VERIFIED_TTL_MS / 1000,
      path: "/",
    },
  );
  // Burn the challenge so a code can't be replayed.
  res.cookies.delete(GUEST_OTP_COOKIE);
  return res;
}
