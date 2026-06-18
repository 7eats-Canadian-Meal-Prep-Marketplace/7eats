import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientSession, unauthorized } from "@/app/api/_lib/client-auth";
import { db } from "@/db";
import { authUser, cookProfiles, followedCooks } from "@/db/schema";

const followCookSchema = z.object({
  cookId: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  try {
    const rows = await db
      .select({
        id: cookProfiles.id,
        displayName: cookProfiles.displayName,
        firstName: authUser.firstName,
        neighborhood: authUser.neighborhood,
        setupComplete: cookProfiles.setupComplete,
        followedAt: followedCooks.createdAt,
      })
      .from(followedCooks)
      .innerJoin(cookProfiles, eq(followedCooks.cookId, cookProfiles.id))
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(eq(followedCooks.userId, session.user.id));

    const data = rows.map((r) => ({
      id: r.id,
      name: r.displayName,
      firstName: r.firstName ?? null,
      neighborhood: r.neighborhood ?? null,
      rating: null,
      isVerified: r.setupComplete,
      followedAt:
        r.followedAt instanceof Date
          ? r.followedAt.toISOString()
          : String(r.followedAt),
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[favourites/cooks/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch followed cooks." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = followCookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { cookId } = parsed.data;

  try {
    const [cook] = await db
      .select({ id: cookProfiles.id })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!cook) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    const [existing] = await db
      .select({ id: followedCooks.id })
      .from(followedCooks)
      .where(
        and(
          eq(followedCooks.userId, session.user.id),
          eq(followedCooks.cookId, cookId),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Already following this cook." },
        { status: 409 },
      );
    }

    await db.insert(followedCooks).values({
      userId: session.user.id,
      cookId,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[favourites/cooks/POST]", err);
    return NextResponse.json(
      { error: "Failed to follow cook." },
      { status: 500 },
    );
  }
}
