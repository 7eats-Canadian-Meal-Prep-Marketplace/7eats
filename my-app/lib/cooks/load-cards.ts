import { and, avg, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  authUser,
  cookPickupWindows,
  cookProfiles,
  cookProfileTags,
  orders,
  reviews,
  tags,
} from "@/db/schema";

export type CookCardData = {
  id: string;
  displayName: string | null;
  cookName: string | null;
  photoUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  tags: { slug: string; label: string }[];
  niches: { slug: string; label: string }[];
  cuisines: { slug: string; label: string }[];
  leadTime: string | null;
  delivery: string | null;
  offersPickup: boolean;
  pickupCity: string | null;
  rating: number | null;
  reviewCount: number;
  ordersCompleted: number;
  priceFrom: number | null;
  representativeDishPhoto: string | null;
  distanceKm: number | null;
  pickupWindows: { dayOfWeek: string; fromTime: string; toTime: string }[];
  deliveryWindows: { dayOfWeek: string; fromTime: string; toTime: string }[];
};

type TagRow = { slug: string; label: string; category: string | null };

/**
 * Hydrate a set of cook ids into full browse/search cards (tags, pickup
 * windows, completed-order counts, rating, price-from, representative photo and
 * haversine distance). Output preserves the order of `cookIds`, so callers
 * control ranking (distance for browse, relevance score for search).
 *
 * Shared by /api/cooks and /api/search to keep the card shape identical.
 */
export async function loadCookCards(
  cookIds: string[],
  opts: { lat?: number | null; lng?: number | null } = {},
): Promise<CookCardData[]> {
  if (cookIds.length === 0) return [];

  const lat = opts.lat ?? null;
  const lng = opts.lng ?? null;
  const hasGeo = lat != null && lng != null;

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
    .leftJoin(
      reviews,
      and(eq(reviews.cookId, cookProfiles.id), eq(reviews.isVisible, true)),
    )
    .where(inArray(cookProfiles.id, cookIds))
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
    );

  const ids = baseRows.map((r) => r.id);

  const tagRows = ids.length
    ? await db
        .select({
          cookId: cookProfileTags.cookProfileId,
          slug: tags.slug,
          label: tags.label,
          category: tags.category,
        })
        .from(cookProfileTags)
        .innerJoin(tags, eq(cookProfileTags.tagId, tags.id))
        .where(inArray(cookProfileTags.cookProfileId, ids))
    : [];
  const tagsByCook: Record<string, TagRow[]> = {};
  for (const t of tagRows) {
    if (!tagsByCook[t.cookId]) tagsByCook[t.cookId] = [];
    tagsByCook[t.cookId].push({
      slug: t.slug,
      label: t.label,
      category: t.category,
    });
  }

  const windowRows = ids.length
    ? await db
        .select({
          cookId: cookPickupWindows.cookId,
          windowType: cookPickupWindows.windowType,
          dayOfWeek: cookPickupWindows.dayOfWeek,
          fromTime: cookPickupWindows.fromTime,
          toTime: cookPickupWindows.toTime,
        })
        .from(cookPickupWindows)
        .where(inArray(cookPickupWindows.cookId, ids))
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

  const orderRows = ids.length
    ? await db
        .select({ cookId: orders.cookId, n: count(orders.id) })
        .from(orders)
        .where(and(inArray(orders.cookId, ids), eq(orders.status, "fulfilled")))
        .groupBy(orders.cookId)
    : [];
  const ordersByCook: Record<string, number> = {};
  for (const o of orderRows) ordersByCook[o.cookId] = Number(o.n);

  const stripCategory = (t: TagRow) => ({ slug: t.slug, label: t.label });

  const cardsById: Record<string, CookCardData> = {};
  for (const row of baseRows) {
    const allTags = tagsByCook[row.id] ?? [];
    const priceRaw = row.priceFrom != null ? Number(row.priceFrom) : null;
    cardsById[row.id] = {
      id: row.id,
      displayName: row.displayName ?? null,
      cookName: [row.firstName, row.lastName].filter(Boolean).join(" ") || null,
      photoUrl: row.photoUrl ?? null,
      bannerUrl: row.bannerUrl ?? null,
      bio: row.bio ?? null,
      tags: allTags.map(stripCategory),
      niches: allTags.filter((t) => t.category === "niche").map(stripCategory),
      cuisines: allTags
        .filter((t) => t.category === "cuisine")
        .map(stripCategory),
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
  }

  // Preserve caller-supplied ranking order.
  return cookIds.map((id) => cardsById[id]).filter(Boolean);
}
