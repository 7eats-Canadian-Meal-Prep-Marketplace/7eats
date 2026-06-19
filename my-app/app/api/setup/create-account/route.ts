import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, dbPool } from "@/db";
import {
  authUser,
  authUserTable,
  cookApplications,
  cookProfiles,
  setupTokens,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { validatePassword } from "@/lib/password";

export async function POST(req: Request) {
  const { token, password } = await req.json();
  if (!token || !password) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const pwError = validatePassword(password);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [tokenRow] = await db
    .update(setupTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(setupTokens.tokenHash, tokenHash),
        isNull(setupTokens.consumedAt),
        gt(setupTokens.expiresAt, new Date()),
      ),
    )
    .returning();

  if (!tokenRow) {
    return NextResponse.json(
      { error: "This link has expired. Please contact us for a new one." },
      { status: 400 },
    );
  }

  const [application] = await db
    .select()
    .from(cookApplications)
    .where(eq(cookApplications.id, tokenRow.applicationId))
    .limit(1);

  if (!application) {
    return NextResponse.json(
      { error: "Application not found." },
      { status: 400 },
    );
  }

  const fullName = `${application.contactFirstName} ${application.contactLastName}`;

  const signUpRes = await auth.api.signUpEmail({
    body: { email: application.contactEmail, password, name: fullName },
    headers: req.headers,
    asResponse: true,
  });

  if (!signUpRes.ok) {
    console.error("[create-account] signup failed:", signUpRes.status);
    return NextResponse.json(
      {
        error: "Could not create account. Please contact us if this persists.",
      },
      { status: 500 },
    );
  }

  const payload = (await signUpRes.json()) as { user?: { id: string } };
  const betterAuthUserId = payload?.user?.id;

  if (!betterAuthUserId) {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  try {
    await dbPool.transaction(async (tx) => {
      await tx
        .update(authUserTable)
        .set({
          role: "cook",
          status: "active",
          firstName: application.contactFirstName,
          lastName: application.contactLastName,
          phoneVerified: false,
          emailVerified: true,
        })
        .where(eq(authUser.id, betterAuthUserId));

      await tx.insert(cookProfiles).values({
        userId: betterAuthUserId,
        applicationId: application.id,
        displayName: application.kitchenName,
      });
    });
  } catch (err) {
    console.error("[create-account] transaction failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const signInRes = await auth.api.signInEmail({
    body: { email: application.contactEmail, password },
    headers: req.headers,
    asResponse: true,
  });

  if (!signInRes.ok) {
    console.error("[create-account] signin failed:", signInRes.status);
    // Account was created — redirect to login so they can sign in manually
    return NextResponse.json({ redirect: "/business-auth/login" });
  }

  // Attach Better Auth's Set-Cookie headers directly to the HTTP response.
  // The browser stores them without any Next.js cookies() indirection.
  const res = NextResponse.json({
    redirect: "/business-auth/setup/verify-phone",
  });
  for (const cookie of (
    signInRes.headers as Headers & { getSetCookie?(): string[] }
  ).getSetCookie?.() ?? []) {
    res.headers.append("Set-Cookie", cookie);
  }
  return res;
}
