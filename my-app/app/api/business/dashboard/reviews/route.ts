import { and, count, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { listings, reviews } from "@/db/schema";

const querySchema = z.object({
  listingId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    listingId: searchParams.get("listingId") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query params." },
      { status: 400 },
    );
  }

  const { listingId, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = and(
    eq(reviews.cookId, cookId),
    eq(reviews.isVisible, true),
    ...(listingId ? [eq(reviews.listingId, listingId)] : []),
  );

  try {
    const [totalResult, data] = await Promise.all([
      db.select({ total: count() }).from(reviews).where(conditions),

      db
        .select({
          id: reviews.id,
          orderId: reviews.orderId,
          cookId: reviews.cookId,
          listingId: reviews.listingId,
          rating: reviews.rating,
          comment: reviews.comment,
          isVisible: reviews.isVisible,
          createdAt: reviews.createdAt,
          listingTitle: listings.title,
        })
        .from(reviews)
        .leftJoin(listings, eq(reviews.listingId, listings.id))
        .where(conditions)
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total: Number(totalResult[0]?.total ?? 0),
        page,
        limit,
      },
    });
  } catch (err) {
    console.error("[dashboard/reviews]", err);
    return NextResponse.json(
      { error: "Failed to fetch reviews." },
      { status: 500 },
    );
  }
}
