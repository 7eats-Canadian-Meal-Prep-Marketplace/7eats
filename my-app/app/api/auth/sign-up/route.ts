import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  authAccount,
  authUser,
  authUserTable,
  legalAcceptances,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { hashIp } from "@/lib/hash";
import { CLIENT_SIGNUP_DOCS, LEGAL_VERSION } from "@/lib/legal";
import { validatePassword } from "@/lib/password";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

// Self-serve account creation for clients (consumers). Cooks never reach this
// route — they are provisioned through the application → setup-token flow. The
// only structural difference from a cook account is `role`: Better Auth's
// signUpEmail defaults new users to `cook` (see lib/auth.ts), so a client
// signup MUST override the role immediately after the user row is created.
const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(128),
    // Clickwrap: the signup form blocks submit until this is true.
    acceptedTerms: z.literal(true),
  })
  .strict();

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form and try again." },
      { status: 400 },
    );
  }

  const { firstName, lastName, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const pwError = validatePassword(password);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const allowed = await logAndCheckRateLimit(`signup:${hashIp(ip)}`, {
    windowMinutes: 60,
    maxAttempts: 5,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }

  // Check for an existing account with this email before hitting Better Auth,
  // so we can handle the unverified-duplicate and guest-checkout cases
  // gracefully.
  const [existing] = await db
    .select({
      id: authUser.id,
      emailVerified: authUser.emailVerified,
      isGuestAccount: authUser.isGuestAccount,
    })
    .from(authUser)
    .where(eq(authUser.email, email))
    .limit(1);

  // A real (non-guest) account already owns this email.
  if (existing && !existing.isGuestAccount) {
    if (!existing.emailVerified) {
      // Account exists but was never verified — resend the link and guide them
      // back to check-email rather than showing a confusing "already exists" error.
      try {
        await auth.api.sendVerificationEmail({
          body: { email, callbackURL: "/app-auth/onboarding" },
        });
      } catch (err) {
        console.error("[sign-up] resend verification failed:", err);
      }
      return NextResponse.json({
        redirect: `/app-auth/signup/check-email?email=${encodeURIComponent(email)}`,
      });
    }
    // Verified account — tell them plainly.
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  let userId: string;

  if (existing?.isGuestAccount) {
    // Guest checkout silently created a shadow user row (random password,
    // flagged isGuestAccount) so the order could attach to a customer. That must
    // NEVER block the person from registering for real with the same email.
    // Instead we *claim* the row: set their chosen password on the existing
    // credential using Better Auth's own hasher (so it verifies on sign-in),
    // then fall through to the shared conversion tail. Their past guest orders
    // stay linked to the now-real account.
    try {
      const ctx = await auth.$context;
      const hashed = await ctx.password.hash(password);
      const updated = await db
        .update(authAccount)
        .set({ password: hashed, updatedAt: new Date() })
        .where(
          and(
            eq(authAccount.userId, existing.id),
            eq(authAccount.providerId, "credential"),
          ),
        )
        .returning({ id: authAccount.id });
      if (updated.length === 0) {
        throw new Error("guest account has no credential to claim");
      }
    } catch (err) {
      console.error("[sign-up] guest account claim failed:", err);
      return NextResponse.json(
        { error: "Could not create account. Please try again." },
        { status: 500 },
      );
    }
    userId = existing.id;
  } else {
    // Create the credential + user row. autoSignIn is disabled globally, so this
    // does NOT start a session — the client must confirm their email first.
    const signUpRes = await auth.api.signUpEmail({
      body: { email, password, name: `${firstName} ${lastName}` },
      headers: req.headers,
      asResponse: true,
    });

    if (!signUpRes.ok) {
      console.error("[sign-up] signup failed:", signUpRes.status);
      return NextResponse.json(
        { error: "Could not create account. Please try again." },
        { status: 500 },
      );
    }

    const payload = (await signUpRes.json()) as { user?: { id: string } };
    const newUserId = payload?.user?.id;
    if (!newUserId) {
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }
    userId = newUserId;
  }

  // Shared conversion tail for both a brand-new signup and a claimed guest row:
  // promote to a `client` (Better Auth defaults new users to `cook`), attach the
  // profile fields, drop the guest flag, and force email verification — a guest
  // never proved ownership of the address, so they must confirm it now.
  //
  // `onboardingCompletedAt` is reset to null so a claimed guest is still routed
  // through the real onboarding flow (phone verification + date of birth +
  // preferences). Guest checkout had stamped it to attach the order, which would
  // otherwise make proxy.ts skip onboarding entirely. No-op for a brand-new row.
  await db
    .update(authUserTable)
    .set({
      role: "client",
      status: "active",
      firstName,
      lastName,
      isGuestAccount: false,
      emailVerified: false,
      onboardingCompletedAt: null,
    })
    .where(eq(authUser.id, userId));

  // Record the clickwrap acceptance as an audit trail. Best-effort: a failure
  // here must not block account creation, which has already succeeded.
  try {
    await db.insert(legalAcceptances).values({
      userId,
      context: "client_signup",
      version: LEGAL_VERSION,
      documents: [...CLIENT_SIGNUP_DOCS],
      ipHash: ip === "unknown" ? null : hashIp(ip),
      userAgent: req.headers.get("user-agent"),
    });
  } catch (err) {
    console.error("[sign-up] legal acceptance record failed:", err);
  }

  // Send the verification email with the correct callbackURL. Better Auth's
  // auto-send is disabled (sendOnSignUp: false) so this is the only send.
  try {
    await auth.api.sendVerificationEmail({
      body: { email, callbackURL: "/app-auth/onboarding" },
    });
  } catch (err) {
    console.error("[sign-up] verification email failed:", err);
  }

  // No session is issued — the client confirms their email, then signs in.
  return NextResponse.json({
    redirect: `/app-auth/signup/check-email?email=${encodeURIComponent(email)}`,
  });
}
