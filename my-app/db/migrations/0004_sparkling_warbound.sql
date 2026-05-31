CREATE TYPE "public"."subscription_interval" AS ENUM('weekly', 'biweekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'cancelled', 'past_due');--> statement-breakpoint
CREATE TABLE "client_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"cook_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "client_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listing_subscription_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"interval" "subscription_interval" NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"stripe_price_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tier_price_positive" CHECK ("listing_subscription_tiers"."price" > 0)
);
--> statement-breakpoint
ALTER TABLE "listing_subscription_tiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "stripe_product_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_tier_id_listing_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."listing_subscription_tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_subscription_tiers" ADD CONSTRAINT "listing_subscription_tiers_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_interval_uidx" ON "listing_subscription_tiers" USING btree ("listing_id","interval");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscription_id_client_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."client_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "subscriptions_select_client" ON "client_subscriptions" AS PERMISSIVE FOR SELECT TO public USING (client_id = auth.uid());--> statement-breakpoint
CREATE POLICY "subscriptions_select_cook" ON "client_subscriptions" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "subscriptions_select_admin" ON "client_subscriptions" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "subscriptions_insert_service" ON "client_subscriptions" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "subscriptions_update_service" ON "client_subscriptions" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "tiers_select_public" ON "listing_subscription_tiers" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (SELECT id FROM listings WHERE status = 'active') AND is_active = TRUE);--> statement-breakpoint
CREATE POLICY "tiers_select_own" ON "listing_subscription_tiers" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "tiers_select_admin" ON "listing_subscription_tiers" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "tiers_insert_service" ON "listing_subscription_tiers" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "tiers_update_service" ON "listing_subscription_tiers" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "tiers_delete_service" ON "listing_subscription_tiers" AS PERMISSIVE FOR DELETE TO public USING (auth.role() = 'service_role');