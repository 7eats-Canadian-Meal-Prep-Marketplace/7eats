import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, authUserTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { validateDateOfBirth16 } from "@/lib/onboarding-validation";

const schema = z.object({
  dateOfBirth: z.string().date(),
});

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

  if (user.onboardingCompletedAt != null) {
    return NextResponse.json(
      { error: "Onboarding is already complete." },
      { status: 409 },
    );
  }

  if (!user.phoneVerified) {
    return NextResponse.json(
      { error: "Verify your phone number before continuing." },
      { status: 403 },
    );
  }

  if (user.dateOfBirth) {
    return NextResponse.json({ success: true });
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
      { error: "Enter a valid date of birth." },
      { status: 400 },
    );
  }

  const ageError = validateDateOfBirth16(parsed.data.dateOfBirth);
  if (ageError) {
    return NextResponse.json({ error: ageError }, { status: 400 });
  }

  await db
    .update(authUserTable)
    .set({ dateOfBirth: parsed.data.dateOfBirth })
    .where(eq(authUserTable.id, session.user.id));

  return NextResponse.json({ success: true });
}
