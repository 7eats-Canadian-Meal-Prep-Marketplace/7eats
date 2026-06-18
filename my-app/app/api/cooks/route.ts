import { and, avg, count, eq, inArray, sql } from "drizzle-orm";
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

function parseCoord(value: string | null, min: number, max: number) {
  if (value == null) return null;
  const n = Number.parseFloat(value);
  if (Number.isNaN(n) || n < min || n > max) return null;
  return n;
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const lat = parseCoord(params.get("lat"), -90, 90);
  const lng = parseCoord(params.get("lng"), -180, 180);
  const hasGeo = lat != null && lng != null;

  try {
    // Haversine distance in km from the requester to each cook's pickup point.
    const distanceExpr = hasGeo
      ? sql<number>`(
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians(${lat})) * cos(radians(${cookProfiles.pickupLat})) *
              cos(radians(${cookProfiles.pickupLng}) - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(${cookProfiles.pickupLat}))
            ))
          )
        )`
      : sql<number | null>`NULL`;

    const baseRows = await db
      .select({
        id: cookProfiles.id,
        displayName: cookProfiles.displayName,
        photoUrl: cookProfiles.photoUrl,
        bio: cookProfiles.bio,
        leadTime: cookProfiles.leadTime,
        delivery: cookProfiles.delivery,
        pickupCity: cookProfiles.pickupCity,
        avgRating: avg(reviews.rating),
        reviewCount: count(reviews.id),
        representativeDishPhoto: sql<string | null>`(
          SELECT dp.url FROM dish_photos dp
          JOIN dishes d ON d.id = dp.dish_id
          WHERE d.cook_id = ${cookProfiles.id} AND d.status = 'active'
          ORDER BY d.created_at ASC, dp.sort_order ASC
          LIMIT 1
        )`,
        distanceKm: distanceExpr,
      })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .leftJoin(reviews, eq(reviews.cookId, cookProfiles.id))
      .where(
        and(
          eq(cookProfiles.setupComplete, true),
          eq(authUser.status, "active"),
        ),
      )
      .groupBy(
        cookProfiles.id,
        cookProfiles.displayName,
        cookProfiles.photoUrl,
        cookProfiles.bio,
        cookProfiles.leadTime,
        cookProfiles.delivery,
        cookProfiles.pickupCity,
        cookProfiles.pickupLat,
        cookProfiles.pickupLng,
      )
      .limit(50);

    const cookIds = baseRows.map((r) => r.id);

    // Cuisine/diet tags per cook.
    const tagRows = cookIds.length
      ? await db
          .select({
            cookId: cookProfileTags.cookProfileId,
            slug: tags.slug,
            label: tags.label,
          })
          .from(cookProfileTags)
          .innerJoin(tags, eq(cookProfileTags.tagId, tags.id))
          .where(inArray(cookProfileTags.cookProfileId, cookIds))
      : [];
    const tagsByCook: Record<string, { slug: string; label: string }[]> = {};
    for (const t of tagRows) {
      if (!tagsByCook[t.cookId]) tagsByCook[t.cookId] = [];
      tagsByCook[t.cookId].push({ slug: t.slug, label: t.label });
    }

    // Fulfilled-order counts per cook (social proof).
    const orderRows = cookIds.length
      ? await db
          .select({ cookId: orders.cookId, n: count(orders.id) })
          .from(orders)
          .where(
            and(
              inArray(orders.cookId, cookIds),
              eq(orders.status, "fulfilled"),
            ),
          )
          .groupBy(orders.cookId)
      : [];
    const ordersByCook: Record<string, number> = {};
    for (const o of orderRows) ordersByCook[o.cookId] = Number(o.n);

    let data = baseRows.map((row) => ({
      id: row.id,
      displayName: row.displayName ?? null,
      photoUrl: row.photoUrl ?? null,
      bio: row.bio ?? null,
      tags: tagsByCook[row.id] ?? [],
      leadTime: row.leadTime ?? null,
      delivery: row.delivery ?? null,
      pickupCity: row.pickupCity ?? null,
      rating:
        row.avgRating != null
          ? Math.round(Number.parseFloat(String(row.avgRating)) * 10) / 10
          : null,
      reviewCount: Number(row.reviewCount),
      ordersCompleted: ordersByCook[row.id] ?? 0,
      representativeDishPhoto: row.representativeDishPhoto ?? null,
      distanceKm:
        row.distanceKm != null
          ? Math.round(Number(row.distanceKm) * 10) / 10
          : null,
    }));

    // Order by proximity when coordinates are supplied.
    if (hasGeo) {
      data = data.sort(
        (a, b) =>
          (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY),
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api/cooks GET]", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch cooks." },
      { status: 500 },
    );
  }
}
