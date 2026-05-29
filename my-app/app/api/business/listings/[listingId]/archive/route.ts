import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { listings } from "@/db/schema";

export type Params = { params: Promise<{ listingId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId } = await params;

  try {
    const [listing] = await db
      .select()
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!listing) return notFound("Listing");

    if (listing.status === "archived") {
      return NextResponse.json(
        { error: "Listing is already archived." },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(listings)
      .set({ status: "archived" })
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[listings]", err);
    return NextResponse.json(
      { error: "Failed to archive listing." },
      { status: 500 },
    );
  }
}
