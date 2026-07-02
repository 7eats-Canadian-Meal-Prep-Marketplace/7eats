import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  DEFAULT_MAX_DELIVERY_KM,
  DELIVERY_MAX_KM_MAX,
} from "@/lib/delivery/pricing";
import {
  SEARCH_MAX_LIMIT,
  SEARCH_PICKUP_MAX_KM,
  SEARCH_SIM_THRESHOLD,
  SEARCH_WEIGHTS,
} from "./config";
import { boundingBox, normalizeQuery } from "./normalize";

export type SearchFulfillment = "pickup" | "delivery";

export type SearchParams = {
  q: string;
  lat: number;
  lng: number;
  mode: SearchFulfillment;
  limit?: number;
  offset?: number;
};

export type SearchHit = {
  cookId: string;
  distanceKm: number | null;
  score: number;
};

/**
 * Rank reachable kitchens for a query using Postgres full-text search blended
 * with trigram fuzzy matching, proximity and a small popularity signal.
 *
 * Pipeline: bounding-box pre-filter (index-friendly) -> exact haversine +
 * reachability for the fulfillment mode -> match on FTS OR a typo-tolerant
 * trigram word-similarity -> weighted score. Because results are always
 * geo-bounded the candidate set stays local, so similarity can be computed with
 * an explicit threshold without relying on a session GUC.
 *
 * Returns cook ids ordered by relevance; hydrate with loadCookCards().
 */
export async function searchCooks(params: SearchParams): Promise<SearchHit[]> {
  const q = normalizeQuery(params.q);
  if (!q) return [];

  const { lat, lng, mode } = params;
  const limit = Math.min(params.limit ?? 30, SEARCH_MAX_LIMIT);
  const offset = Math.max(params.offset ?? 0, 0);

  // Radius for the bounding-box pre-filter + proximity normalization.
  const capKm = mode === "pickup" ? SEARCH_PICKUP_MAX_KM : DELIVERY_MAX_KM_MAX;
  const box = boundingBox(lat, lng, capKm);

  const w = SEARCH_WEIGHTS;

  // Reachability differs by fulfillment mode.
  const reachable =
    mode === "pickup"
      ? sql`offers_pickup = true AND distance_km <= ${SEARCH_PICKUP_MAX_KM}`
      : sql`delivery = 'self' AND distance_km <= COALESCE(max_delivery_km, ${DEFAULT_MAX_DELIVERY_KM})`;

  // Proximity divisor: pickup uses the soft cap; delivery uses the max zone.
  const proxCap =
    mode === "pickup" ? SEARCH_PICKUP_MAX_KM : DELIVERY_MAX_KM_MAX;

  const result = await db.execute(sql`
    WITH scored AS (
      SELECT
        csi.cook_id AS cook_id,
        ts_rank(csi.document, websearch_to_tsquery('english', ${q})) AS fts_rank,
        word_similarity(${q}, csi.terms) AS sim,
        (csi.document @@ websearch_to_tsquery('english', ${q})) AS fts_match,
        csi.offers_pickup AS offers_pickup,
        csi.delivery AS delivery,
        csi.max_delivery_km AS max_delivery_km,
        csi.avg_rating AS avg_rating,
        csi.orders_completed AS orders_completed,
        (
          6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(${lat})) * cos(radians(csi.pickup_lat)) *
            cos(radians(csi.pickup_lng) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(csi.pickup_lat))
          )))
        ) AS distance_km
      FROM cook_search_index csi
      WHERE csi.is_visible
        AND csi.pickup_lat IS NOT NULL
        AND csi.pickup_lng IS NOT NULL
        AND csi.pickup_lat BETWEEN ${box.minLat} AND ${box.maxLat}
        AND csi.pickup_lng BETWEEN ${box.minLng} AND ${box.maxLng}
    )
    SELECT
      cook_id,
      ROUND(distance_km::numeric, 1) AS distance_km,
      (
        ${w.fts} * fts_rank
        + ${w.similarity} * sim
        + ${w.proximity} * GREATEST(0, 1 - (distance_km / ${proxCap}))
        + ${w.popularity} * (COALESCE(avg_rating, 0) / 5.0)
      ) AS score
    FROM scored
    WHERE (fts_match OR sim >= ${SEARCH_SIM_THRESHOLD})
      AND ${reachable}
    ORDER BY score DESC, distance_km ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const rows = (result.rows ?? []) as Array<{
    cook_id: string;
    distance_km: string | number | null;
    score: string | number | null;
  }>;

  return rows.map((r) => ({
    cookId: String(r.cook_id),
    distanceKm: r.distance_km != null ? Number(r.distance_km) : null,
    score: r.score != null ? Number(r.score) : 0,
  }));
}
