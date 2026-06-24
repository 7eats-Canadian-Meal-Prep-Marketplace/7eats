/**
 * Backfill the cook_search_index for every existing cook.
 * Run once after applying migration 0007: node scripts/backfill-search-index.mjs
 *
 * The SQL mirrors lib/search/index-builder.ts (runRebuild with cookId = NULL).
 * Keep the two in sync if the document/terms composition changes.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");

let url = process.env.DATABASE_URL;
if (!url) {
  try {
    const envContent = readFileSync(envPath, "utf-8");
    url = envContent.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  } catch {
    // fall through
  }
}
if (!url) throw new Error("DATABASE_URL not found in env or .env.local");

const sql = neon(url);

// $1 = cook_id filter (NULL rebuilds every cook).
const REBUILD = `
WITH target AS (
  SELECT
    cp.id AS cook_id, cp.display_name, cp.bio, cp.setup_complete,
    cp.pickup_lat, cp.pickup_lng, cp.max_delivery_km, cp.offers_pickup, cp.delivery,
    u.status AS user_status
  FROM cook_profiles cp
  JOIN "user" u ON u.id = cp.user_id
  WHERE $1::uuid IS NULL OR cp.id = $1::uuid
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
  WHERE d.status = 'active' AND ($1::uuid IS NULL OR d.cook_id = $1::uuid)
  GROUP BY d.cook_id
),
tag_agg AS (
  SELECT
    cpt.cook_profile_id AS cook_id,
    string_agg(DISTINCT t.label, ' ') FILTER (WHERE t.category = 'cuisine') AS cuisine_tags,
    string_agg(DISTINCT t.label, ' ') FILTER (WHERE t.category = 'niche') AS niche_tags
  FROM cook_profile_tags cpt
  JOIN tags t ON t.id = cpt.tag_id
  WHERE $1::uuid IS NULL OR cpt.cook_profile_id = $1::uuid
  GROUP BY cpt.cook_profile_id
),
rating_agg AS (
  SELECT r.cook_id, AVG(r.rating)::numeric(3, 2) AS avg_rating
  FROM reviews r
  WHERE $1::uuid IS NULL OR r.cook_id = $1::uuid
  GROUP BY r.cook_id
),
order_agg AS (
  SELECT o.cook_id, COUNT(*) AS orders_completed
  FROM orders o
  WHERE o.status = 'fulfilled' AND ($1::uuid IS NULL OR o.cook_id = $1::uuid)
  GROUP BY o.cook_id
),
composed AS (
  SELECT
    tg.cook_id,
    COALESCE(tg.display_name, '') AS name,
    TRIM(BOTH ' ' FROM concat_ws(' ', ta.cuisine_tags, da.dish_cuisines)) AS cuisines,
    COALESCE(da.dish_names, '') AS dish_names,
    TRIM(BOTH ' ' FROM concat_ws(' ', tg.bio, da.dish_descriptions, da.dish_categories, ta.niche_tags)) AS details,
    (tg.setup_complete AND tg.user_status = 'active' AND COALESCE(da.active_dish_count, 0) > 0) AS is_visible,
    tg.pickup_lat, tg.pickup_lng, tg.max_delivery_km, tg.offers_pickup, tg.delivery,
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
  is_visible, pickup_lat, pickup_lng, max_delivery_km, offers_pickup, delivery,
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
`;

console.log("Backfilling cook_search_index for all cooks …");
await sql.query(REBUILD, [null]);
const [{ count }] = await sql.query(
  "SELECT count(*)::int AS count FROM cook_search_index",
);
console.log(`Done. cook_search_index now holds ${count} row(s).`);
