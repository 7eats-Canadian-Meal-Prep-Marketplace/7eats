import { and, count, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, reviews } from "@/db/schema";

type RouteContext = { params: Promise<{ listingId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { listingId } = await params;

  const urlParams = new URL(req.url).searchParams;

  const rawLimit = Number.parseInt(urlParams.get("limit") ?? "20", 10);
  const limit = Number.isNaN(rawLimit)
    ? 20
    : Math.min(100, Math.max(1, rawLimit));

  const rawOffset = Number.parseInt(urlParams.get("offset") ?? "0", 10);
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset);

  try {
    const where = and(
      eq(reviews.listingId, listingId),
      eq(reviews.isVisible, true),
    );

    const [{ total }] = await db
      .select({ total: count() })
      .from(reviews)
      .where(where);

    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
      })
      .from(reviews)
      .leftJoin(authUser, eq(reviews.clientId, authUser.id))
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => {
      const first = r.firstName ?? "";
      const lastInitial = r.lastName ? `${r.lastName.charAt(0)}.` : "";
      const reviewerName = lastInitial
        ? `${first} ${lastInitial}`.trim()
        : first.trim() || "Anonymous";

      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment ?? null,
        reviewerName,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : (r.createdAt ?? null),
      };
    });

    return NextResponse.json({
      success: true,
      data,
      meta: { total, limit, offset },
    });
  } catch (err) {
    console.error("[listings/[listingId]/reviews/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch reviews." },
      { status: 500 },
    );
  }
}
