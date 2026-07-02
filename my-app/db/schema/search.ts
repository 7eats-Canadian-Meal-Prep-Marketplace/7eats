import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { cookProfiles } from "./cooks";
import { deliveryEnum } from "./enums";

const isAdmin = sql`auth.role() = 'admin'`;
const isService = sql`auth.role() = 'service_role'`;

// Postgres tsvector. Drizzle has no first-class type for it; the column is
// written as a precomputed full-text document by the index builder, and the
// exact DDL (plus the pg_trgm extension and GIN indexes) lives in the
// hand-authored migration 0007_cook_search_index.sql.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * Denormalized, query-optimized search document — one row per cook.
 *
 * Rather than join + aggregate dishes, tags and the profile on every keystroke,
 * we precompute each cook's searchable text into:
 *   - `document` (tsvector) for ranked, stemmed full-text search
 *   - `terms`    (text)     for trigram fuzzy / typo-tolerant matching
 *
 * Geo + ranking signals are denormalized too so the search query needs no joins
 * to filter by reachability or order results. Visibility is precomputed into
 * `isVisible` because the app's DB role bypasses RLS — the search query must
 * filter publicly-visible cooks itself.
 *
 * Maintained by lib/search/index-builder.ts (called from mutation routes and
 * the backfill script). See migration 0007 for indexes and the pg_trgm setup.
 */
export const cookSearchIndex = pgTable(
  "cook_search_index",
  {
    cookId: uuid("cook_id")
      .primaryKey()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    // Weighted full-text document (kitchen name = A, cuisines = A, dish names =
    // B, descriptions/categories/bio = C). Written by the index builder.
    document: tsvector("document").notNull().default(sql`''::tsvector`),
    // Lower-cased concatenation of all searchable text — trigram match source.
    terms: text("terms").notNull().default(""),
    // Precomputed public visibility: setup complete + active user + >=1 active dish.
    isVisible: boolean("is_visible").notNull().default(false),
    // Denormalized geo for reachability filtering without joins.
    pickupLat: doublePrecision("pickup_lat"),
    pickupLng: doublePrecision("pickup_lng"),
    maxDeliveryKm: integer("max_delivery_km"),
    offersPickup: boolean("offers_pickup").notNull().default(true),
    delivery: deliveryEnum("delivery"),
    // Denormalized ranking signals (tie-breakers / quality boost).
    avgRating: numeric("avg_rating", { precision: 3, scale: 2 }),
    ordersCompleted: integer("orders_completed").notNull().default(0),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Full-text search over the weighted document.
    index("cook_search_document_gin").using("gin", t.document),
    // Typo-tolerant trigram matching over the raw terms.
    index("cook_search_terms_trgm").using("gin", t.terms.op("gin_trgm_ops")),
    // Bounding-box geo pre-filter, limited to visible cooks.
    index("cook_search_geo_idx")
      .on(t.pickupLat, t.pickupLng)
      .where(sql`is_visible = true`),
    // Public read: the index only mirrors already-public, visible browse data.
    pgPolicy("cook_search_index_select_public", {
      for: "select",
      to: "public",
      using: sql`is_visible = true`,
    }),
    pgPolicy("cook_search_index_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    // Writes are service-only; maintained by the index builder.
    pgPolicy("cook_search_index_insert_service", {
      for: "insert",
      to: "public",
      withCheck: isService,
    }),
    pgPolicy("cook_search_index_update_service", {
      for: "update",
      to: "public",
      using: isService,
    }),
    pgPolicy("cook_search_index_delete_service", {
      for: "delete",
      to: "public",
      using: isService,
    }),
  ],
).enableRLS();
