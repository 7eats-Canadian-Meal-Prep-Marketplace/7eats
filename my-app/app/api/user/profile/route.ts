import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, authUserTable } from "@/db/schema";
import { auth } from "@/lib/auth";

const profileFields = {
  name: authUser.name,
  firstName: authUser.firstName,
  lastName: authUser.lastName,
  phone: authUser.phone,
  phoneVerified: authUser.phoneVerified,
  dateOfBirth: authUser.dateOfBirth,
  email: authUser.email,
  image: authUser.image,
} as const;

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const [user] = await db
      .select({ ...profileFields, status: authUser.status })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    if (!user || user.status === "deleted") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const { status: _status, ...data } = user;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[user/profile/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch profile." },
      { status: 500 },
    );
  }
}

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(20).optional().nullable(),
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

  const updates: Partial<typeof authUser.$inferInsert> = {};
  if (parsed.data.firstName !== undefined) {
    updates.firstName = parsed.data.firstName;
  }
  if (parsed.data.lastName !== undefined) {
    updates.lastName = parsed.data.lastName;
  }
  if (parsed.data.phone !== undefined) {
    const phone = parsed.data.phone?.trim() || null;
    updates.phone = phone;
    updates.phoneVerified = false;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields provided to update." },
      { status: 400 },
    );
  }

  try {
    const [current] = await db
      .select({
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        email: authUser.email,
      })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const firstName = updates.firstName ?? current.firstName;
    const lastName = updates.lastName ?? current.lastName;
    updates.name =
      [firstName, lastName].filter(Boolean).join(" ").trim() || current.email;
    updates.updatedAt = new Date();

    await db
      .update(authUserTable)
      .set(updates)
      .where(eq(authUser.id, session.user.id));

    const [updated] = await db
      .select(profileFields)
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
