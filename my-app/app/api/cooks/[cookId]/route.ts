import { and, avg, count, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  authUser,
  cookProfiles,
  cookProfileTags,
  orders,
  reviews,
  tags,
} from "@/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cookId: string }> },
) {
  const { cookId } = await params;

  try {
    // Fetch cook profile joined with auth user
    const [row] = await db
      .select({
        id: cookProfiles.id,
        userId: authUser.id,
        displayName: cookProfiles.displayName,
        photoUrl: cookProfiles.photoUrl,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        bio: cookProfiles.bio,
        neighborhood: authUser.neighborhood,
        leadTime: cookProfiles.leadTime,
        minOrderQty: cookProfiles.minOrderQty,
        maxOrderQty: cookProfiles.maxOrderQty,
        cancellationAllowed: cookProfiles.cancellationAllowed,
        isVerified: cookProfiles.setupComplete,
        createdAt: cookProfiles.createdAt,
      })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    // Compute orders completed
    const [{ ordersCompleted }] = await db
      .select({ ordersCompleted: count() })
      .from(orders)
      .where(
        sql`${orders.cookId} = ${cookId} AND ${orders.status} = 'fulfilled'`,
      );

    // Compute rating stats
    const [{ avgRating, reviewCount }] = await db
      .select({
        avgRating: avg(reviews.rating),
        reviewCount: count(),
      })
      .from(reviews)
      .where(
        sql`${reviews.cookId} = ${cookId} AND ${reviews.isVisible} = TRUE`,
      );

    // Cuisine tags (category = 'cuisine') for the profile subtitle.
    const cuisineRows = await db
      .select({ label: tags.label })
      .from(cookProfileTags)
      .innerJoin(tags, eq(cookProfileTags.tagId, tags.id))
      .where(
        and(
          eq(cookProfileTags.cookProfileId, cookId),
          eq(tags.category, "cuisine"),
        ),
      );
    const cuisineTypes = cuisineRows.map((t) => t.label);

    const name =
      [row.firstName, row.lastName].filter(Boolean).join(" ") || "Unknown Cook";

    const memberSince = row.createdAt
      ? String(new Date(row.createdAt).getFullYear())
      : null;

    const rating = avgRating != null ? parseFloat(String(avgRating)) : null;

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        userId: row.userId,
        name,
        displayName: row.displayName ?? null,
        photoUrl: row.photoUrl ?? null,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        bio: row.bio ?? null,
        cuisineTypes,
        neighborhood: row.neighborhood ?? null,
        rating: rating != null ? Math.round(rating * 10) / 10 : null,
        reviewCount: Number(reviewCount),
        yearsExperience: null,
        isVerified: row.isVerified ?? false,
        memberSince,
        ordersCompleted: Number(ordersCompleted),
        leadTime: row.leadTime ?? null,
        minOrderQty: row.minOrderQty,
        maxOrderQty: row.maxOrderQty,
        cancellationAllowed: row.cancellationAllowed,
      },
    });
  } catch (err) {
    console.error("[cooks/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch cook profile." },
      { status: 500 },
    );
  }
}
