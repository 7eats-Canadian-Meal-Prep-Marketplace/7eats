import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Recompute the denormalized search document for one cook (or every cook when
 * `cookId` is null). Aggregates the cook's profile, active dishes and tags into
 * a weighted tsvector (`document`) for full-text ranking and a lower-cased text
 * blob (`terms`) for trigram fuzzy matching, then upserts the row.
 *
 * Visibility (`is_visible`) mirrors the public browse predicate — setup
 * complete, active user account, and at least one active dish — because the
 * app's DB role bypasses RLS, so the search query filters on this flag.
 *
 * Runs as a single INSERT … SELECT … ON CONFLICT so the row is rebuilt
 * atomically. Safe to call after any mutation that changes a cook's searchable
 * data; failures should be logged but never block the originating request.
 */
async function runRebuild(cookId: string | null): Promise<void> {
  await db.execute(sql`
    WITH target AS (
      SELECT
        cp.id AS cook_id,
        cp.display_name,
        cp.bio,
        cp.setup_complete,
        cp.pickup_lat,
        cp.pickup_lng,
        cp.max_delivery_km,
        cp.offers_pickup,
        cp.delivery,
        u.status AS user_status
      FROM cook_profiles cp
      JOIN "user" u ON u.id = cp.user_id
      WHERE ${cookId}::uuid IS NULL OR cp.id = ${cookId}::uuid
    ),
    dish_agg AS (
      SELECT
        d.cook_id,
        string_agg(DISTINCT d.name, ' ') AS dish_names,
        string_agg(DISTINCT COALESCE(d.description, ''), ' ') AS dish_descriptions,
        string_agg(DISTINCT COALESCE(d.cuisine, ''), ' ') AS dish_cuisines,
        string_agg(DISTINCT array_to_string(d.categories, ' '), ' ') AS dish_categories,
        COUNT(*) AS active_dish_count
      FROM dishes d
      WHERE d.status = 'active'
        AND (${cookId}::uuid IS NULL OR d.cook_id = ${cookId}::uuid)
      GROUP BY d.cook_id
    ),
    tag_agg AS (
      SELECT
        cpt.cook_profile_id AS cook_id,
        string_agg(DISTINCT t.label, ' ') FILTER (WHERE t.category = 'cuisine') AS cuisine_tags,
        string_agg(DISTINCT t.label, ' ') FILTER (WHERE t.category = 'niche') AS niche_tags
      FROM cook_profile_tags cpt
      JOIN tags t ON t.id = cpt.tag_id
      WHERE ${cookId}::uuid IS NULL OR cpt.cook_profile_id = ${cookId}::uuid
      GROUP BY cpt.cook_profile_id
    ),
    rating_agg AS (
      SELECT r.cook_id, AVG(r.rating)::numeric(3, 2) AS avg_rating
      FROM reviews r
      WHERE ${cookId}::uuid IS NULL OR r.cook_id = ${cookId}::uuid
      GROUP BY r.cook_id
    ),
    order_agg AS (
      SELECT o.cook_id, COUNT(*) AS orders_completed
      FROM orders o
      WHERE o.status = 'fulfilled'
        AND (${cookId}::uuid IS NULL OR o.cook_id = ${cookId}::uuid)
      GROUP BY o.cook_id
    ),
    composed AS (
      SELECT
        tg.cook_id,
        COALESCE(tg.display_name, '') AS name,
        TRIM(BOTH ' ' FROM concat_ws(' ', ta.cuisine_tags, da.dish_cuisines)) AS cuisines,
        COALESCE(da.dish_names, '') AS dish_names,
        TRIM(BOTH ' ' FROM concat_ws(' ', tg.bio, da.dish_descriptions, da.dish_categories, ta.niche_tags)) AS details,
        (
          tg.setup_complete
          AND tg.user_status = 'active'
          AND COALESCE(da.active_dish_count, 0) > 0
        ) AS is_visible,
        tg.pickup_lat,
        tg.pickup_lng,
        tg.max_delivery_km,
        tg.offers_pickup,
        tg.delivery,
        ra.avg_rating,
        COALESCE(oa.orders_completed, 0)::int AS orders_completed
      FROM target tg
      LEFT JOIN dish_agg da ON da.cook_id = tg.cook_id
      LEFT JOIN tag_agg ta ON ta.cook_id = tg.cook_id
      LEFT JOIN rating_agg ra ON ra.cook_id = tg.cook_id
      LEFT JOIN order_agg oa ON oa.cook_id = tg.cook_id
    )
    INSERT INTO cook_search_index (
      cook_id, document, terms, is_visible,
      pickup_lat, pickup_lng, max_delivery_km, offers_pickup, delivery,
      avg_rating, orders_completed, updated_at
    )
    SELECT
      cook_id,
      setweight(to_tsvector('english', name), 'A')
        || setweight(to_tsvector('english', cuisines), 'A')
        || setweight(to_tsvector('english', dish_names), 'B')
        || setweight(to_tsvector('english', details), 'C'),
      lower(concat_ws(' ', name, cuisines, dish_names, details)),
      is_visible,
      pickup_lat, pickup_lng, max_delivery_km, offers_pickup, delivery,
      avg_rating, orders_completed, now()
    FROM composed
    ON CONFLICT (cook_id) DO UPDATE SET
      document = EXCLUDED.document,
      terms = EXCLUDED.terms,
      is_visible = EXCLUDED.is_visible,
      pickup_lat = EXCLUDED.pickup_lat,
      pickup_lng = EXCLUDED.pickup_lng,
      max_delivery_km = EXCLUDED.max_delivery_km,
      offers_pickup = EXCLUDED.offers_pickup,
      delivery = EXCLUDED.delivery,
      avg_rating = EXCLUDED.avg_rating,
      orders_completed = EXCLUDED.orders_completed,
      updated_at = now();
  `);
}

/** Rebuild the search index row for a single cook. */
export async function rebuildCookSearchIndex(cookId: string): Promise<void> {
  await runRebuild(cookId);
}

/** Rebuild the search index for every cook (used by the backfill script). */
export async function rebuildAllCookSearchIndexes(): Promise<void> {
  await runRebuild(null);
}

/**
 * Fire-and-forget rebuild for use inside request handlers. Never throws — search
 * index freshness must not break the originating mutation. Logs on failure.
 */
export function rebuildCookSearchIndexSafe(cookId: string): void {
  rebuildCookSearchIndex(cookId).catch((err) => {
    console.error("[search index] rebuild failed for cook", cookId, err);
  });
}
