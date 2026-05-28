"use server";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { generateSignedPhone, verifySignedPhone } from "@/lib/cookie";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

function normalizeToE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendOtp(phone: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated." };

  const e164 = normalizeToE164(phone);
  if (!e164) return { error: "Enter a valid North American phone number." };

  const allowed = await logAndCheckRateLimit(session.user.id, {
    windowMinutes: 10,
    maxAttempts: 3,
  });
  if (!allowed) return { error: "Too many attempts. Try again in 10 minutes." };

  // MOCK: production would call Twilio Verify start here

  const signed = generateSignedPhone(e164);
  const jar = await cookies();
  jar.set("pending_phone", signed, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return {};
}

export async function verifyOtp(code: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated." };

  const jar = await cookies();
  const signed = jar.get("pending_phone")?.value;
  if (!signed) return { error: "Session expired. Please request a new code." };

  const phone = verifySignedPhone(signed);
  if (!phone) return { error: "Session expired. Please request a new code." };

  // MOCK: production would call Twilio Verify check here; accept hardcoded "123456"
  if (code !== "123456") return { error: "Incorrect code. Try again." };

  await db
    .update(users)
    .set({ phone, phoneVerified: true })
    .where(eq(users.id, session.user.id));

  jar.delete("pending_phone");

  redirect("/business-auth/setup/onboarding?step=1");
}
