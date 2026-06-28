import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, authUserTable, userPreferences } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  clientPreferencesValidationError,
  normalizeClientPreferences,
} from "@/lib/client-preferences";
import { validateDateOfBirth16 } from "@/lib/onboarding-validation";

const schema = z.object({
  dietary: z.array(z.string()),
  allergies: z.array(z.string()),
  goals: z.array(z.string()),
  whyMealPrep: z.array(z.string()).optional().default([]),
  dateOfBirth: z.string().date().optional(),
});

function issueOnboardedCookie(res: NextResponse) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `7eats-onboarded=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  );
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const [user] = await db
    .select({
      role: authUser.role,
      phoneVerified: authUser.phoneVerified,
      dateOfBirth: authUser.dateOfBirth,
      onboardingCompletedAt: authUser.onboardingCompletedAt,
    })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .limit(1);

  if (!user || user.role !== "client") {
    return NextResponse.json(
      { error: "Only client accounts can complete onboarding." },
      { status: 403 },
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
      { error: "Invalid preferences." },
      { status: 400 },
    );
  }

  const { dateOfBirth } = parsed.data;
  const prefs = normalizeClientPreferences(parsed.data);
  const prefsError = clientPreferencesValidationError(prefs);
  if (prefsError) {
    return NextResponse.json({ error: prefsError }, { status: 400 });
  }

  const { dietary, allergies, goals, whyMealPrep } = prefs;
  const userId = session.user.id;
  const isFirstCompletion = user.onboardingCompletedAt == null;

  if (isFirstCompletion) {
    if (!user.phoneVerified) {
      return NextResponse.json(
        { error: "Verify your phone number before finishing onboarding." },
        { status: 403 },
      );
    }

    const resolvedDob = dateOfBirth ?? user.dateOfBirth ?? null;
    if (!resolvedDob) {
      return NextResponse.json(
        { error: "Date of birth is required." },
        { status: 400 },
      );
    }

    const ageError = validateDateOfBirth16(resolvedDob);
    if (ageError) {
      return NextResponse.json({ error: ageError }, { status: 400 });
    }
  }

  await db
    .insert(userPreferences)
    .values({ userId, dietary, allergies, goals, whyMealPrep })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { dietary, allergies, goals, whyMealPrep, updatedAt: new Date() },
    });

  if (isFirstCompletion) {
    const resolvedDob = dateOfBirth ?? user.dateOfBirth;
    await db
      .update(authUserTable)
      .set({
        onboardingCompletedAt: new Date(),
        ...(resolvedDob && !user.dateOfBirth
          ? { dateOfBirth: resolvedDob }
          : {}),
      })
      .where(eq(authUserTable.id, userId));
  }

  const res = NextResponse.json({ success: true });
  issueOnboardedCookie(res);
  return res;
}
