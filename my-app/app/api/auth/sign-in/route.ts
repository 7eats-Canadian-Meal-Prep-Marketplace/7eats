import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hashIp } from "@/lib/hash";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const body = await req.json();
  const { email, password } = body;
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
  const rawAudience = body?.audience;
  const audience =
    rawAudience === "client" || rawAudience === "business" ? rawAudience : null;

  const [account] = await db
    .select({
      role: authUser.role,
      emailVerified: authUser.emailVerified,
      onboardingCompletedAt: authUser.onboardingCompletedAt,
      status: authUser.status,
    })
    .from(authUser)
    .where(eq(authUser.email, normalizedEmail))
    .limit(1);

  if (account?.status === "deleted") {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  if (account?.role === "client" && !account.emailVerified) {
    return NextResponse.json(
      {
        error:
          "Please confirm your email before signing in. Check your inbox for the link.",
      },
      { status: 403 },
    );
  }

  const isCookOrAdmin = account?.role === "cook" || account?.role === "admin";
  const isClient = account?.role === "client";

  if (audience === "client" && isCookOrAdmin) {
    return NextResponse.json(
      {
        error:
          "This account is registered as a cook. Sign in at the business portal instead.",
        code: "wrong_portal",
      },
      { status: 403 },
    );
  }

  if (audience === "business" && isClient) {
    return NextResponse.json(
      {
        error:
          "This account is a customer account. Sign in on the 7eats app instead.",
        code: "wrong_portal",
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

  const redirect = isCookOrAdmin ? "/business/dashboard" : "/app/browse";

  const res = NextResponse.json({ redirect });
  for (const cookie of (
    authRes.headers as Headers & { getSetCookie?(): string[] }
  ).getSetCookie?.() ?? []) {
    res.headers.append("Set-Cookie", cookie);
  }

  // Re-issue onboarding cookie from DB so it survives new devices/cleared browsers.
  if (isClient && account?.onboardingCompletedAt != null) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.headers.append(
      "Set-Cookie",
      `7eats-onboarded=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
    );
  }

  return res;
}
