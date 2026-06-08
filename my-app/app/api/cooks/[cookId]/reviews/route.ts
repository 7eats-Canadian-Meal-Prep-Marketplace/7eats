import { count, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles, listings, reviews } from "@/db/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cookId: string }> },
) {
  const { cookId } = await params;

  const searchParams = new URL(req.url).searchParams;

  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isNaN(rawLimit)
    ? 20
    : Math.min(100, Math.max(1, rawLimit));

  const rawOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset);

  try {
    const [cook] = await db
      .select({ id: cookProfiles.id })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!cook) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    const whereClause = sql`${reviews.cookId} = ${cookId} AND ${reviews.isVisible} = TRUE`;

    const [{ total }] = await db
      .select({ total: count() })
      .from(reviews)
      .where(whereClause);

    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        reviewerFirstName: authUser.firstName,
        reviewerLastName: authUser.lastName,
        listingTitle: listings.title,
      })
      .from(reviews)
      .innerJoin(authUser, eq(reviews.clientId, authUser.id))
      .leftJoin(listings, eq(reviews.listingId, listings.id))
      .where(whereClause)
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => {
      const firstName = r.reviewerFirstName ?? "";
      const lastInitial = r.reviewerLastName
        ? `${r.reviewerLastName.charAt(0)}.`
        : "";
      const reviewerName =
        [firstName, lastInitial].filter(Boolean).join(" ") || "Anonymous";

      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment ?? null,
        reviewerName,
        listingTitle: r.listingTitle ?? null,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
      };
    });

    return NextResponse.json({
      success: true,
      data,
      meta: { total: Number(total), limit, offset },
    });
  } catch (err) {
    console.error("[cooks/reviews/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch cook reviews." },
      { status: 500 },
    );
  }
}
