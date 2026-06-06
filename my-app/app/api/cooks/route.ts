import { avg, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles, orders, reviews } from "@/db/schema";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: cookProfiles.id,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        neighborhood: authUser.neighborhood,
        avgRating: avg(reviews.rating),
        reviewCount: count(reviews.id),
        ordersCompleted: sql<number>`cast(count(distinct case when ${orders.status} = 'fulfilled' then ${orders.id} end) as integer)`,
      })
      .from(cookProfiles)
      .leftJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .leftJoin(reviews, eq(reviews.cookId, cookProfiles.id))
      .leftJoin(orders, eq(orders.cookId, cookProfiles.id))
      .where(eq(cookProfiles.setupComplete, true))
      .groupBy(
        cookProfiles.id,
        authUser.firstName,
        authUser.lastName,
        authUser.neighborhood,
      )
      .limit(8);

    const data = rows.map((row) => ({
      id: row.id,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      neighborhood: row.neighborhood ?? null,
      rating:
        row.avgRating != null
          ? Math.round(parseFloat(String(row.avgRating)) * 10) / 10
          : null,
      reviewCount: Number(row.reviewCount),
      ordersCompleted: Number(row.ordersCompleted),
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api/cooks GET]", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch cooks." },
      { status: 500 },
    );
  }
}
