import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles, orderDishes, reviews } from "@/db/schema";

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
    // Reviews are part of the public kitchen — hidden until onboarding is
    // complete, so an incomplete (or inactive) cook 404s like a missing one.
    const [cook] = await db
      .select({ id: cookProfiles.id })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(
        and(
          eq(cookProfiles.id, cookId),
          eq(authUser.status, "active"),
          eq(cookProfiles.setupComplete, true),
        ),
      )
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
        orderId: reviews.orderId,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        reviewerFirstName: authUser.firstName,
        reviewerLastName: authUser.lastName,
      })
      .from(reviews)
      .innerJoin(authUser, eq(reviews.clientId, authUser.id))
      .where(whereClause)
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);

    // Attach the dish names ordered for each review (social proof), derived from
    // the order via order_dishes — no listing reference needed.
    const orderIds = rows.map((r) => r.orderId);
    const dishRows = orderIds.length
      ? await db
          .select({
            orderId: orderDishes.orderId,
            name: orderDishes.dishName,
          })
          .from(orderDishes)
          .where(inArray(orderDishes.orderId, orderIds))
      : [];
    const dishesByOrder: Record<string, string[]> = {};
    for (const d of dishRows) {
      if (!dishesByOrder[d.orderId]) dishesByOrder[d.orderId] = [];
      dishesByOrder[d.orderId].push(d.name);
    }

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
        dishes: dishesByOrder[r.orderId] ?? [],
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
