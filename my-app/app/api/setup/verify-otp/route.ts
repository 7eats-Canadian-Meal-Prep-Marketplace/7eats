import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { verifySignedPhone } from "@/lib/cookie";

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

  const jar = await cookies();
  const signed = jar.get("pending_phone")?.value;
  if (!signed) {
    return NextResponse.json(
      { error: "Session expired. Please request a new code." },
      { status: 400 },
    );
  }

  const phone = verifySignedPhone(signed);
  if (!phone) {
    return NextResponse.json(
      { error: "Session expired. Please request a new code." },
      { status: 400 },
    );
  }

  let status: string;
  try {
    const check = await twilioClient()
      .verify.v2.services(verifyServiceSid())
      .verificationChecks.create({ to: phone, code });
    status = check.status;
  } catch (err) {
    console.error("[verify-otp]", err);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 },
    );
  }

  if (status !== "approved") {
    return NextResponse.json(
      { error: "Incorrect code. Try again." },
      { status: 400 },
    );
  }

  await db
    .update(authUser)
    .set({ phone, phoneVerified: true })
    .where(eq(authUser.id, session.user.id));

  const res = NextResponse.json({
    redirect: "/business-auth/setup/onboarding?step=1",
  });
  res.cookies.delete("pending_phone");
  return res;
}
