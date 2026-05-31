CREATE TABLE "listing_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"label" varchar(100),
	"quantity" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_quantity_positive" CHECK ("listing_bundles"."quantity" >= 1),
	CONSTRAINT "bundle_price_positive" CHECK ("listing_bundles"."price" > 0)
);
--> statement-breakpoint
ALTER TABLE "listing_bundles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "cancellation_notice_days" integer;--> statement-breakpoint
ALTER TABLE "listing_bundles" ADD CONSTRAINT "listing_bundles_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_bundles_listing_qty_uidx" ON "listing_bundles" USING btree ("listing_id","quantity");--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_cancellation_notice_days_non_negative" CHECK ("listings"."cancellation_notice_days" IS NULL OR "listings"."cancellation_notice_days" >= 0);--> statement-breakpoint
CREATE POLICY "listing_bundles_select_public" ON "listing_bundles" AS PERMISSIVE FOR SELECT TO public USING (
        is_active = TRUE
        AND listing_id IN (SELECT id FROM listings WHERE status = 'active')
      );--> statement-breakpoint
CREATE POLICY "listing_bundles_select_own" ON "listing_bundles" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "listing_bundles_select_admin" ON "listing_bundles" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "listing_bundles_insert_own" ON "listing_bundles" AS PERMISSIVE FOR INSERT TO public WITH CHECK (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "listing_bundles_update_own" ON "listing_bundles" AS PERMISSIVE FOR UPDATE TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "listing_bundles_delete_own" ON "listing_bundles" AS PERMISSIVE FOR DELETE TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));