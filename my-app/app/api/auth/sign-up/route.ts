import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hashIp } from "@/lib/hash";
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
  // so we can handle the unverified-duplicate case gracefully.
  const [existing] = await db
    .select({ emailVerified: authUser.emailVerified })
    .from(authUser)
    .where(eq(authUser.email, email))
    .limit(1);

  if (existing) {
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
  const userId = payload?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  // Promote the fresh row from the default `cook` to `client` and attach the
  // profile fields.
  await db
    .update(authUser)
    .set({ role: "client", status: "active", firstName, lastName })
    .where(eq(authUser.id, userId));

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
