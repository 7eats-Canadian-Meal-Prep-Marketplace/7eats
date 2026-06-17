import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/db";
import { authUserTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { verifySignedPhone } from "@/lib/cookie";
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

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }

  const allowed = await logAndCheckRateLimit(
    `client-verify-otp:${session.user.id}`,
    { windowMinutes: 10, maxAttempts: 5 },
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 },
    );
  }

  const jar = await cookies();
  const signed = jar.get("pending_phone")?.value;
  if (!signed) {
    return NextResponse.json(
      { error: "Session expired. Request a new code." },
      { status: 400 },
    );
  }

  const phone = verifySignedPhone(signed);
  if (!phone) {
    return NextResponse.json(
      { error: "Session expired. Request a new code." },
      { status: 400 },
    );
  }

  let approved: boolean;
  if (OTP_DEV_BYPASS) {
    approved = code === DEV_OTP_CODE;
  } else {
    try {
      const check = await twilioClient()
        .verify.v2.services(verifyServiceSid())
        .verificationChecks.create({ to: phone, code });
      approved = check.status === "approved";
    } catch (err) {
      console.error("[client/verify-otp]", err);
      return NextResponse.json(
        { error: "Verification failed. Please try again." },
        { status: 500 },
      );
    }
  }

  if (!approved) {
    return NextResponse.json(
      { error: "Incorrect code. Try again." },
      { status: 400 },
    );
  }

  await db
    .update(authUserTable)
    .set({ phone, phoneVerified: true })
    .where(eq(authUserTable.id, session.user.id));

  const res = NextResponse.json({ success: true });
  res.cookies.delete("pending_phone");
  return res;
}
