import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, userPreferences } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  clientPreferencesValidationError,
  normalizeClientPreferences,
} from "@/lib/client-preferences";

const preferencesSchema = z.object({
  dietary: z.array(z.string()),
  allergies: z.array(z.string()),
  goals: z.array(z.string()),
  whyMealPrep: z.array(z.string()).optional().default([]),
});

async function requireClient(sessionUserId: string) {
  const [user] = await db
    .select({ role: authUser.role })
    .from(authUser)
    .where(eq(authUser.id, sessionUserId))
    .limit(1);

  if (!user || user.role !== "client") {
    return null;
  }
  return user;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const client = await requireClient(session.user.id);
  if (!client) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  try {
    const [prefs] = await db
      .select({
        dietary: userPreferences.dietary,
        allergies: userPreferences.allergies,
        goals: userPreferences.goals,
        whyMealPrep: userPreferences.whyMealPrep,
      })
      .from(userPreferences)
      .where(eq(userPreferences.userId, session.user.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: normalizeClientPreferences(prefs ?? undefined),
    });
  } catch (err) {
    console.error("[user/preferences/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch preferences." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const client = await requireClient(session.user.id);
  if (!client) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const prefs = normalizeClientPreferences(parsed.data);
  const prefsError = clientPreferencesValidationError(prefs);
  if (prefsError) {
    return NextResponse.json({ error: prefsError }, { status: 400 });
  }

  const { dietary, allergies, goals, whyMealPrep } = prefs;

  try {
    const [saved] = await db
      .insert(userPreferences)
      .values({
        userId: session.user.id,
        dietary,
        allergies,
        goals,
        whyMealPrep,
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { dietary, allergies, goals, whyMealPrep, updatedAt: new Date() },
      })
      .returning({
        dietary: userPreferences.dietary,
        allergies: userPreferences.allergies,
        goals: userPreferences.goals,
        whyMealPrep: userPreferences.whyMealPrep,
      });

    return NextResponse.json({
      success: true,
      data: normalizeClientPreferences(saved),
    });
  } catch (err) {
    console.error("[user/preferences/PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update preferences." },
      { status: 500 },
    );
  }
}
