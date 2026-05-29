import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hashIp } from "@/lib/hash";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const allowed = await logAndCheckRateLimit(`login:${hashIp(ip)}`, {
    windowMinutes: 15,
    maxAttempts: 5,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const normalizedEmail = (email as string).toLowerCase().trim();

  // Look up role + verification status before attempting sign-in so unverified
  // clients get a clear message and never receive a session. Cooks are never
  // gated on email verification (they're provisioned via a trusted setup link).
  const [account] = await db
    .select({ role: authUser.role, emailVerified: authUser.emailVerified })
    .from(authUser)
    .where(eq(authUser.email, normalizedEmail))
    .limit(1);

  if (account?.role === "client" && !account.emailVerified) {
    return NextResponse.json(
      {
        error:
          "Please confirm your email before signing in. Check your inbox for the link.",
      },
      { status: 403 },
    );
  }

  const authRes = await auth.api.signInEmail({
    body: { email: normalizedEmail, password },
    headers: req.headers,
    asResponse: true,
  });

  if (!authRes.ok) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  // One login endpoint serves both audiences; route by role. Cooks land on
  // their dashboard (middleware bounces them to onboarding if setup is
  // incomplete); clients land on their account.
  const redirect =
    account?.role === "cook" || account?.role === "admin"
      ? "/business/dashboard"
      : "/account";

  const res = NextResponse.json({ redirect });
  for (const cookie of (
    authRes.headers as Headers & { getSetCookie?(): string[] }
  ).getSetCookie?.() ?? []) {
    res.headers.append("Set-Cookie", cookie);
  }
  return res;
}
