import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, authUserTable, cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";

function resolvePhoneVerified(user: {
  phone: string | null;
  phoneVerified: boolean;
  setupComplete: boolean | null;
}): boolean {
  if (user.phoneVerified) return true;
  // Cooks only reach the dashboard after verify-phone; treat a on-file
  // number as verified when the flag was never persisted (legacy rows).
  if (user.phone && user.setupComplete) return true;
  return false;
}

const USER_FIELDS = {
  id: authUser.id,
  firstName: authUser.firstName,
  lastName: authUser.lastName,
  phone: authUser.phone,
  phoneVerified: authUser.phoneVerified,
  email: authUser.email,
  name: authUser.name,
} as const;

const patchSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const [row] = await db
      .select({
        id: authUser.id,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        phone: authUser.phone,
        phoneVerified: authUser.phoneVerified,
        email: authUser.email,
        name: authUser.name,
        setupComplete: cookProfiles.setupComplete,
      })
      .from(authUser)
      .leftJoin(cookProfiles, eq(cookProfiles.userId, authUser.id))
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const { setupComplete, ...user } = row;

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        phoneVerified: resolvePhoneVerified({
          phone: user.phone,
          phoneVerified: user.phoneVerified,
          setupComplete: setupComplete ?? false,
        }),
      },
    });
  } catch (err) {
    console.error("[business/me GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch user profile." },
      { status: 500 },
    );
  }
}

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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const updates: Partial<typeof authUser.$inferInsert> = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  try {
    const [updated] = await db
      .update(authUserTable)
      .set(updates)
      .where(eq(authUser.id, session.user.id))
      .returning(USER_FIELDS);

    if (!updated) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[business/me PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update user profile." },
      { status: 500 },
    );
  }
}
