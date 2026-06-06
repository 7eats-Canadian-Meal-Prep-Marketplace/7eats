import { avg, count, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles, orders, reviews } from "@/db/schema";

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
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        bio: cookProfiles.bio,
        neighborhood: authUser.neighborhood,
        leadTime: cookProfiles.leadTime,
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
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        bio: row.bio ?? null,
        cuisineTypes: [],
        neighborhood: row.neighborhood ?? null,
        rating: rating != null ? Math.round(rating * 10) / 10 : null,
        reviewCount: Number(reviewCount),
        yearsExperience: null,
        isVerified: row.isVerified ?? false,
        memberSince,
        ordersCompleted: Number(ordersCompleted),
        leadTime: row.leadTime ?? null,
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
