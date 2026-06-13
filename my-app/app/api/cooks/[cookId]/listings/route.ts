import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cookProfiles, listings } from "@/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cookId: string }> },
) {
  const { cookId } = await params;

  try {
    const [cook] = await db
      .select({ id: cookProfiles.id })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!cook) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    const rows = await db
      .select({
        id: listings.id,
        title: listings.title,
        description: listings.description,
        type: listings.type,
        subscriptionEnabled: listings.subscriptionEnabled,
        basePrice: listings.basePrice,
        currency: listings.currency,
        coverPhotoUrl: listings.coverPhotoUrl,
        minOrderQty: listings.minOrderQty,
        maxOrderQty: listings.maxOrderQty,
        createdAt: listings.createdAt,
      })
      .from(listings)
      .where(and(eq(listings.cookId, cookId), eq(listings.status, "active")));

    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      type: r.type,
      subscriptionEnabled: r.subscriptionEnabled,
      basePrice: parseFloat(String(r.basePrice)),
      currency: r.currency,
      coverPhotoUrl: r.coverPhotoUrl ?? null,
      minOrderQty: r.minOrderQty,
      maxOrderQty: r.maxOrderQty ?? null,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[cooks/listings/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch cook listings." },
      { status: 500 },
    );
  }
}
