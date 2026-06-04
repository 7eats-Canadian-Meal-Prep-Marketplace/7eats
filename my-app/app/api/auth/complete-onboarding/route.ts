import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, userPreferences } from "@/db/schema";
import { auth } from "@/lib/auth";

const schema = z.object({
  dietary: z.array(z.string()),
  allergies: z.array(z.string()),
  goals: z.array(z.string()),
  whyMealPrep: z.array(z.string()).optional().default([]),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
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

  const { dietary, allergies, goals, whyMealPrep } = parsed.data;
  const userId = session.user.id;

  await db
    .insert(userPreferences)
    .values({ userId, dietary, allergies, goals, whyMealPrep })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { dietary, allergies, goals, whyMealPrep, updatedAt: new Date() },
    });

  await db
    .update(authUser)
    .set({ onboardingCompletedAt: new Date() })
    .where(eq(authUser.id, userId));

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const res = NextResponse.json({ success: true });
  res.headers.append(
    "Set-Cookie",
    `7eats-onboarded=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  );
  return res;
}
