import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, authUserTable, legalAcceptances } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sendGuestActivationEmail } from "@/lib/emails/guest-checkout";
import { hashIp } from "@/lib/hash";
import { GUEST_CHECKOUT_DOCS, LEGAL_VERSION } from "@/lib/legal";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(20),
  // Clickwrap: the guest checkout form blocks submit until this is true.
  acceptedTerms: z.literal(true),
});

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const allowed = await logAndCheckRateLimit(`guest-checkout:${hashIp(ip)}`, {
    windowMinutes: 60,
    maxAttempts: 10,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Please fill in all fields.",
      },
      { status: 400 },
    );
  }

  const { firstName, lastName, phone } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  // Check for an existing account with this email before hitting Better Auth.
  const [existing] = await db
    .select({ id: authUser.id, isGuestAccount: authUser.isGuestAccount })
    .from(authUser)
    .where(eq(authUser.email, email))
    .limit(1);

  if (existing) {
    if (!existing.isGuestAccount) {
      // Real account exists — tell client to redirect to login.
      return NextResponse.json({ needsLogin: true, email });
    }
    // Guest account already exists for this email (e.g. retry after failed payment).
    // Return needsLogin with isGuest flag so the client can show an appropriate message.
    return NextResponse.json({ needsLogin: true, email, isGuest: true });
  }

  // Use a fresh random password — never exposed to the user.
  const tempPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;

  // Create the credential + user row via Better Auth.
  const signUpRes = await auth.api.signUpEmail({
    body: { email, password: tempPassword, name: `${firstName} ${lastName}` },
    headers: req.headers,
    asResponse: true,
  });

  if (!signUpRes.ok) {
    console.error("[guest-checkout] signUpEmail failed:", signUpRes.status);
    return NextResponse.json(
      { error: "Could not create guest account. Please try again." },
      { status: 500 },
    );
  }

  const payload = (await signUpRes.json()) as { user?: { id: string } };
  const userId = payload?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  // Promote to client, mark as guest, verify email, mark onboarding done.
  // emailVerified must be set to true so the sign-in below succeeds.
  await db
    .update(authUserTable)
    .set({
      role: "client",
      status: "active",
      firstName,
      lastName,
      phone,
      isGuestAccount: true,
      emailVerified: true,
      onboardingCompletedAt: new Date(),
    })
    .where(eq(authUser.id, userId));

  // Record the clickwrap acceptance. Best-effort — never block the checkout.
  try {
    await db.insert(legalAcceptances).values({
      userId,
      context: "guest_checkout",
      version: LEGAL_VERSION,
      documents: [...GUEST_CHECKOUT_DOCS],
      ipHash: ip === "unknown" ? null : hashIp(ip),
      userAgent: req.headers.get("user-agent"),
    });
  } catch (err) {
    console.error("[guest-checkout] legal acceptance record failed:", err);
  }

  // Sign in — emailVerified is now true so Better Auth will allow this.
  const signInRes = await auth.api.signInEmail({
    body: { email, password: tempPassword },
    headers: req.headers,
    asResponse: true,
  });

  if (!signInRes.ok) {
    console.error("[guest-checkout] signInEmail failed:", signInRes.status);
    return NextResponse.json(
      { error: "Account created but could not sign in. Please try again." },
      { status: 500 },
    );
  }

  // Build response and forward session cookie(s) from Better Auth.
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const res = NextResponse.json({ success: true, email });

  signInRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      res.headers.append("set-cookie", value);
    }
  });

  // Add the onboarded cookie so the proxy knows not to redirect to onboarding.
  res.headers.append(
    "set-cookie",
    `7eats-onboarded=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  );

  // Fire-and-forget: send the guest a "set your password" activation email.
  sendGuestActivationEmail(email);

  return res;
}
