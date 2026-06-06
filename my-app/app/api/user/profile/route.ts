import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const [user] = await db
      .select({
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        phone: authUser.phone,
        neighborhood: authUser.neighborhood,
        dateOfBirth: authUser.dateOfBirth,
        email: authUser.email,
      })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (err) {
    console.error("[user/profile/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch profile." },
      { status: 500 },
    );
  }
}

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  neighborhood: z.string().max(100).optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
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

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields provided to update." },
      { status: 400 },
    );
  }

  try {
    await db
      .update(authUser)
      .set(updates)
      .where(eq(authUser.id, session.user.id));

    const [updated] = await db
      .select({
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        phone: authUser.phone,
        neighborhood: authUser.neighborhood,
        dateOfBirth: authUser.dateOfBirth,
        email: authUser.email,
      })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    if (!updated) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[user/profile/PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update profile." },
      { status: 500 },
    );
  }
}
