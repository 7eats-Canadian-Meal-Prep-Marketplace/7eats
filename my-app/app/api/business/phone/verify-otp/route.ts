import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/db";
import { authUser, authUserTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { verifySignedPhone } from "@/lib/cookie";
import { DEV_OTP_CODE, OTP_DEV_BYPASS } from "@/lib/otp-dev";
import {
  isPhoneTakenForRole,
  isUniqueViolation,
  type PhoneOwnerRole,
  phoneTakenMessage,
} from "@/lib/phone-availability";
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
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }

  const allowed = await logAndCheckRateLimit(
    `business-verify-otp:${session.user.id}`,
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
      console.error("[business/phone/verify-otp]", err);
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

  // A phone may be verified on at most one account of this role. Cross-role
  // sharing (e.g. the same number on a client account) is allowed.
  const role = session.user.role as PhoneOwnerRole;
  if (await isPhoneTakenForRole(phone, role, session.user.id)) {
    return NextResponse.json(
      { error: phoneTakenMessage(role) },
      { status: 409 },
    );
  }

  let updated: { phone: string | null; phoneVerified: boolean } | undefined;
  try {
    [updated] = await db
      .update(authUserTable)
      .set({ phone, phoneVerified: true })
      .where(eq(authUser.id, session.user.id))
      .returning({
        phone: authUser.phone,
        phoneVerified: authUser.phoneVerified,
      });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: phoneTakenMessage(role) },
        { status: 409 },
      );
    }
    throw err;
  }

  if (!updated) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const res = NextResponse.json({ success: true, data: updated });
  res.cookies.delete("pending_phone");
  return res;
}
