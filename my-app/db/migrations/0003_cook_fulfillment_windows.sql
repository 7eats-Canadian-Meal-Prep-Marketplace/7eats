ALTER TABLE "cook_pickup_windows" ADD COLUMN "window_type" text DEFAULT 'pickup' NOT NULL;--> statement-breakpoint
ALTER TABLE "cook_pickup_windows" DROP CONSTRAINT IF EXISTS "cpw_window_type_valid";--> statement-breakpoint
ALTER TABLE "cook_pickup_windows" ADD CONSTRAINT "cpw_window_type_valid" CHECK ("window_type" IN ('pickup','delivery'));--> statement-breakpoint
DROP INDEX IF EXISTS "cpw_cook_day_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "cpw_cook_type_day_uidx" ON "cook_pickup_windows" USING btree ("cook_id","window_type","day_of_week");--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD COLUMN "offers_pickup" boolean DEFAULT true NOT NULL;
