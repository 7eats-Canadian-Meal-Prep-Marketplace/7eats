-- Scalable, typo-tolerant kitchen search.
-- Denormalized per-cook search document: full-text (tsvector) for ranked/stemmed
-- matching + trigram (pg_trgm) for typo tolerance, plus geo + ranking signals so
-- the search query needs no joins. Maintained by lib/search/index-builder.ts.

-- Trigram extension powers fuzzy matching ("shawrma" -> "shawarma").
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cook_search_index" (
  "cook_id" uuid PRIMARY KEY NOT NULL,
  "document" tsvector DEFAULT ''::tsvector NOT NULL,
  "terms" text DEFAULT '' NOT NULL,
  "is_visible" boolean DEFAULT false NOT NULL,
  "pickup_lat" double precision,
  "pickup_lng" double precision,
  "max_delivery_km" integer,
  "offers_pickup" boolean DEFAULT true NOT NULL,
  "delivery" "delivery_enum",
  "avg_rating" numeric(3, 2),
  "orders_completed" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "cook_search_index" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cook_search_index_cook_id_cook_profiles_id_fk'
  ) THEN
    ALTER TABLE "cook_search_index"
      ADD CONSTRAINT "cook_search_index_cook_id_cook_profiles_id_fk"
      FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

-- GIN index for full-text search over the weighted document.
CREATE INDEX IF NOT EXISTS "cook_search_document_gin"
  ON "cook_search_index" USING gin ("document");--> statement-breakpoint

-- GIN trigram index for typo-tolerant fuzzy matching over raw terms.
CREATE INDEX IF NOT EXISTS "cook_search_terms_trgm"
  ON "cook_search_index" USING gin ("terms" gin_trgm_ops);--> statement-breakpoint

-- Bounding-box geo pre-filter, limited to visible cooks.
CREATE INDEX IF NOT EXISTS "cook_search_geo_idx"
  ON "cook_search_index" ("pickup_lat", "pickup_lng")
  WHERE "is_visible" = true;--> statement-breakpoint

-- Public read (visible rows only); writes are service-only.
CREATE POLICY "cook_search_index_select_public" ON "cook_search_index"
  AS PERMISSIVE FOR SELECT TO public USING (is_visible = true);--> statement-breakpoint
CREATE POLICY "cook_search_index_select_admin" ON "cook_search_index"
  AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "cook_search_index_insert_service" ON "cook_search_index"
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "cook_search_index_update_service" ON "cook_search_index"
  AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "cook_search_index_delete_service" ON "cook_search_index"
  AS PERMISSIVE FOR DELETE TO public USING (auth.role() = 'service_role');
