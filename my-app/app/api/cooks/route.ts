import { and, avg, count, eq, exists, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  authUser,
  cookPickupWindows,
  cookProfiles,
  cookProfileTags,
  dishes,
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
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        photoUrl: cookProfiles.photoUrl,
        bannerUrl: cookProfiles.bannerUrl,
        bio: cookProfiles.bio,
        leadTime: cookProfiles.leadTime,
        delivery: cookProfiles.delivery,
        offersPickup: cookProfiles.offersPickup,
        pickupCity: cookProfiles.pickupCity,
        avgRating: avg(reviews.rating),
        reviewCount: count(reviews.id),
        priceFrom: sql<string | null>`(
          SELECT MIN(d.price)::text FROM dishes d
          WHERE d.cook_id = ${cookProfiles.id} AND d.status = 'active'
        )`,
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
          exists(
            db
              .select({ id: dishes.id })
              .from(dishes)
              .where(
                and(
                  eq(dishes.cookId, cookProfiles.id),
                  eq(dishes.status, "active"),
                ),
              ),
          ),
        ),
      )
      .groupBy(
        cookProfiles.id,
        cookProfiles.displayName,
        authUser.firstName,
        authUser.lastName,
        cookProfiles.photoUrl,
        cookProfiles.bannerUrl,
        cookProfiles.bio,
        cookProfiles.leadTime,
        cookProfiles.delivery,
        cookProfiles.offersPickup,
        cookProfiles.pickupCity,
        cookProfiles.pickupLat,
        cookProfiles.pickupLng,
      )
      .limit(50);

    const cookIds = baseRows.map((r) => r.id);

    // Tags per cook (cuisine, niche, dietary).
    const tagRows = cookIds.length
      ? await db
          .select({
            cookId: cookProfileTags.cookProfileId,
            slug: tags.slug,
            label: tags.label,
            category: tags.category,
          })
          .from(cookProfileTags)
          .innerJoin(tags, eq(cookProfileTags.tagId, tags.id))
          .where(inArray(cookProfileTags.cookProfileId, cookIds))
      : [];
    type TagRow = { slug: string; label: string; category: string | null };
    const tagsByCook: Record<string, TagRow[]> = {};
    for (const t of tagRows) {
      if (!tagsByCook[t.cookId]) tagsByCook[t.cookId] = [];
      tagsByCook[t.cookId].push({
        slug: t.slug,
        label: t.label,
        category: t.category,
      });
    }

    const windowRows = cookIds.length
      ? await db
          .select({
            cookId: cookPickupWindows.cookId,
            windowType: cookPickupWindows.windowType,
            dayOfWeek: cookPickupWindows.dayOfWeek,
            fromTime: cookPickupWindows.fromTime,
            toTime: cookPickupWindows.toTime,
          })
          .from(cookPickupWindows)
          .where(inArray(cookPickupWindows.cookId, cookIds))
      : [];
    const pickupWindowsByCook: Record<
      string,
      { dayOfWeek: string; fromTime: string; toTime: string }[]
    > = {};
    const deliveryWindowsByCook: Record<
      string,
      { dayOfWeek: string; fromTime: string; toTime: string }[]
    > = {};
    for (const w of windowRows) {
      const entry = {
        dayOfWeek: w.dayOfWeek,
        fromTime: w.fromTime,
        toTime: w.toTime,
      };
      if (w.windowType === "delivery") {
        if (!deliveryWindowsByCook[w.cookId])
          deliveryWindowsByCook[w.cookId] = [];
        deliveryWindowsByCook[w.cookId].push(entry);
      } else {
        if (!pickupWindowsByCook[w.cookId]) pickupWindowsByCook[w.cookId] = [];
        pickupWindowsByCook[w.cookId].push(entry);
      }
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

    let data = baseRows.map((row) => {
      const allTags = tagsByCook[row.id] ?? [];
      const stripCategory = (t: TagRow) => ({ slug: t.slug, label: t.label });
      const niches = allTags
        .filter((t) => t.category === "niche")
        .map(stripCategory);
      const cuisines = allTags
        .filter((t) => t.category === "cuisine")
        .map(stripCategory);
      const priceRaw = row.priceFrom != null ? Number(row.priceFrom) : null;
      return {
        id: row.id,
        displayName: row.displayName ?? null,
        cookName:
          [row.firstName, row.lastName].filter(Boolean).join(" ") || null,
        photoUrl: row.photoUrl ?? null,
        bannerUrl: row.bannerUrl ?? null,
        bio: row.bio ?? null,
        tags: allTags.map(stripCategory),
        niches,
        cuisines,
        leadTime: row.leadTime ?? null,
        delivery: row.delivery ?? null,
        offersPickup: row.offersPickup !== false,
        pickupCity: row.pickupCity ?? null,
        rating:
          row.avgRating != null
            ? Math.round(Number.parseFloat(String(row.avgRating)) * 10) / 10
            : null,
        reviewCount: Number(row.reviewCount),
        ordersCompleted: ordersByCook[row.id] ?? 0,
        priceFrom:
          priceRaw != null && !Number.isNaN(priceRaw)
            ? Math.round(priceRaw * 100) / 100
            : null,
        representativeDishPhoto: row.representativeDishPhoto ?? null,
        distanceKm:
          row.distanceKm != null
            ? Math.round(Number(row.distanceKm) * 10) / 10
            : null,
        pickupWindows: pickupWindowsByCook[row.id] ?? [],
        deliveryWindows: deliveryWindowsByCook[row.id] ?? [],
      };
    });

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
