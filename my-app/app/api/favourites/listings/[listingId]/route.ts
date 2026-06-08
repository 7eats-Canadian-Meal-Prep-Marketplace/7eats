import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getClientSession,
  unauthorized,
} from "@/app/api/subscriptions/_lib/client-auth";
import { db } from "@/db";
import { savedListings } from "@/db/schema";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  const { listingId } = await params;

  try {
    await db
      .delete(savedListings)
      .where(
        and(
          eq(savedListings.userId, session.user.id),
          eq(savedListings.listingId, listingId),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[favourites/listings/[listingId]/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to unsave listing." },
      { status: 500 },
    );
  }
}
