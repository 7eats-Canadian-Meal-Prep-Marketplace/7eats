import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getClientSession, unauthorized } from "@/app/api/_lib/client-auth";
import { db } from "@/db";
import { followedCooks } from "@/db/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cookId: string }> },
) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  const { cookId } = await params;

  try {
    const [row] = await db
      .select({ id: followedCooks.id })
      .from(followedCooks)
      .where(
        and(
          eq(followedCooks.userId, session.user.id),
          eq(followedCooks.cookId, cookId),
        ),
      )
      .limit(1);

    return NextResponse.json({
      success: true,
      data: { following: Boolean(row) },
    });
  } catch (err) {
    console.error("[favourites/cooks/[cookId]/GET]", err);
    return NextResponse.json(
      { error: "Failed to check follow status." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ cookId: string }> },
) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  const { cookId } = await params;

  try {
    await db
      .delete(followedCooks)
      .where(
        and(
          eq(followedCooks.userId, session.user.id),
          eq(followedCooks.cookId, cookId),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[favourites/cooks/[cookId]/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to unfollow cook." },
      { status: 500 },
    );
  }
}
