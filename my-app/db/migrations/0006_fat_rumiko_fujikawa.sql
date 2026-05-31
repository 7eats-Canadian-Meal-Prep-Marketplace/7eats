CREATE TABLE "stripe_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "stripe_webhook_events_select_admin" ON "stripe_webhook_events" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "stripe_webhook_events_insert_service" ON "stripe_webhook_events" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "stripe_webhook_events_delete_service" ON "stripe_webhook_events" AS PERMISSIVE FOR DELETE TO public USING (auth.role() = 'service_role');--> statement-breakpoint
ALTER POLICY "listing_bundles_select_own" ON "listing_bundles" TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
ALTER POLICY "listing_bundles_insert_own" ON "listing_bundles" TO public WITH CHECK (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
ALTER POLICY "listing_bundles_update_own" ON "listing_bundles" TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
ALTER POLICY "listing_bundles_delete_own" ON "listing_bundles" TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));