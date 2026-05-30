ALTER TABLE "cook_profiles" ADD COLUMN "email_notifications_new_order" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD COLUMN "email_notifications_new_review" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD COLUMN "sms_notifications_new_order" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "cook_response" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "cook_response_at" timestamp;--> statement-breakpoint
ALTER POLICY "user_update_own" ON "user" TO public USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text);