import { NextResponse } from "next/server";
import twilio from "twilio";
import { auth } from "@/lib/auth";
import { generateSignedPhone } from "@/lib/cookie";
import { DEV_OTP_CODE, OTP_DEV_BYPASS } from "@/lib/otp-dev";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

function twilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials not set");
  return twilio(sid, token);
}

function verifyServiceSid() {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) throw new Error("TWILIO_VERIFY_SERVICE_SID not set");
  return sid;
}

function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (session.user.role !== "client") {
    return NextResponse.json(
      { error: "Only client accounts can verify a phone here." },
      { status: 403 },
    );
  }

  const { phone } = await req.json();
  const e164 = toE164(phone ?? "");
  if (!e164) {
    return NextResponse.json(
      { error: "Enter a valid North American phone number." },
      { status: 400 },
    );
  }

  const allowed = await logAndCheckRateLimit(`client-otp:${session.user.id}`, {
    windowMinutes: 10,
    maxAttempts: 3,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 10 minutes." },
      { status: 429 },
    );
  }

  // Dev bypass: skip the SMS entirely and accept DEV_OTP_CODE at verification.
  if (OTP_DEV_BYPASS) {
    console.log(
      `[client/send-otp] dev bypass — enter code ${DEV_OTP_CODE} to verify ${e164}`,
    );
  } else {
    try {
      await twilioClient()
        .verify.v2.services(verifyServiceSid())
        .verifications.create({ to: e164, channel: "sms" });
    } catch (err) {
      console.error("[client/send-otp]", err);
      return NextResponse.json(
        { error: "Could not send code. Please try again." },
        { status: 500 },
      );
    }
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("pending_phone", generateSignedPhone(e164), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
