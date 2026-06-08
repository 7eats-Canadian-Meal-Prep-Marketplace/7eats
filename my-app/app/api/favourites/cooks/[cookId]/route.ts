import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getClientSession,
  unauthorized,
} from "@/app/api/subscriptions/_lib/client-auth";
import { db } from "@/db";
import { followedCooks } from "@/db/schema";

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
