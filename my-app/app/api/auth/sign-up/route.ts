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
    // Optional for clients — no phone verification in this flow.
    phone: z.string().trim().max(20).optional(),
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
  const phone = parsed.data.phone?.trim() ? parsed.data.phone.trim() : null;

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

  // Better Auth owns credentials + session creation. autoSignIn (on by default)
  // means a successful signUpEmail also returns the session Set-Cookie headers.
  const signUpRes = await auth.api.signUpEmail({
    body: { email, password, name: `${firstName} ${lastName}` },
    headers: req.headers,
    asResponse: true,
  });

  if (!signUpRes.ok) {
    // 422 = Better Auth rejected the credentials; the common case is a
    // duplicate email. Keep the message generic but actionable.
    if (signUpRes.status === 422) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }
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
  // profile fields. Session data is read from the DB on each getSession, so
  // this is reflected immediately without re-issuing the cookie.
  await db
    .update(authUser)
    .set({ role: "client", status: "active", firstName, lastName, phone })
    .where(eq(authUser.id, userId));

  // Forward Better Auth's session cookie to the browser, then send the client
  // to their account.
  const res = NextResponse.json({ redirect: "/account" });
  for (const cookie of (
    signUpRes.headers as Headers & { getSetCookie?(): string[] }
  ).getSetCookie?.() ?? []) {
    res.headers.append("Set-Cookie", cookie);
  }
  return res;
}
