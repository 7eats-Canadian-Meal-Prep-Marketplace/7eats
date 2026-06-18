CREATE TABLE "dish_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dish_id" uuid NOT NULL,
	"type" "promotion_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dish_promo_value_positive" CHECK ("dish_promotions"."value" > 0),
	CONSTRAINT "dish_promo_percentage_max" CHECK ("dish_promotions"."type" != 'percentage_off' OR "dish_promotions"."value" <= 100),
	CONSTRAINT "dish_promo_max_uses_positive" CHECK ("dish_promotions"."max_uses" IS NULL OR "dish_promotions"."max_uses" >= 1),
	CONSTRAINT "dish_promo_uses_count_non_negative" CHECK ("dish_promotions"."uses_count" >= 0),
	CONSTRAINT "dish_promo_uses_count_cap" CHECK ("dish_promotions"."max_uses" IS NULL OR "dish_promotions"."uses_count" <= "dish_promotions"."max_uses"),
	CONSTRAINT "dish_promo_dates_order" CHECK ("dish_promotions"."valid_from" IS NULL OR "dish_promotions"."valid_until" IS NULL OR "dish_promotions"."valid_until" > "dish_promotions"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "dish_promotions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cook_profiles" DROP CONSTRAINT "cook_profiles_late_cancel_window_positive";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_quantity_positive";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_unit_price_positive";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_promotion_id_listing_promotions_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_subscription_id_client_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_listing_id_listings_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_listing_id_listings_id_fk";
--> statement-breakpoint
DROP INDEX "orders_subscription_period_uidx";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "listing_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "quantity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "quantity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "unit_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "listing_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD COLUMN "min_order_qty" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD COLUMN "max_order_qty" integer;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD COLUMN "cancellation_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "price" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "order_dishes" ADD COLUMN "price_snapshot" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "order_dishes" ADD COLUMN "promotion_id" uuid;--> statement-breakpoint
ALTER TABLE "order_dishes" ADD COLUMN "discount_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order_dishes" ADD COLUMN "line_total" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellation_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dish_promotions" ADD CONSTRAINT "dish_promotions_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dish_promotions_one_active_uidx" ON "dish_promotions" USING btree ("dish_id") WHERE is_active = true;--> statement-breakpoint
ALTER TABLE "order_dishes" ADD CONSTRAINT "order_dishes_promotion_id_dish_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."dish_promotions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_min_order_qty_positive" CHECK ("cook_profiles"."min_order_qty" >= 1);--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_max_order_qty_valid" CHECK ("cook_profiles"."max_order_qty" IS NULL OR "cook_profiles"."max_order_qty" >= "cook_profiles"."min_order_qty");--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_price_positive" CHECK ("dishes"."price" > 0);--> statement-breakpoint
ALTER TABLE "order_dishes" ADD CONSTRAINT "order_dishes_discount_non_negative" CHECK ("order_dishes"."discount_amount" IS NULL OR "order_dishes"."discount_amount" >= 0);--> statement-breakpoint
ALTER TABLE "order_dishes" ADD CONSTRAINT "order_dishes_line_total_non_negative" CHECK ("order_dishes"."line_total" >= 0);--> statement-breakpoint
CREATE POLICY "dish_promotions_select_public" ON "dish_promotions" AS PERMISSIVE FOR SELECT TO public USING (
        is_active = TRUE
        AND dish_id IN (SELECT id FROM dishes WHERE status = 'active')
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until > NOW())
        AND (max_uses IS NULL OR uses_count < max_uses)
      );--> statement-breakpoint
CREATE POLICY "dish_promotions_select_own" ON "dish_promotions" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
CREATE POLICY "dish_promotions_select_admin" ON "dish_promotions" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "dish_promotions_insert_own" ON "dish_promotions" AS PERMISSIVE FOR INSERT TO public WITH CHECK (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
CREATE POLICY "dish_promotions_update_own" ON "dish_promotions" AS PERMISSIVE FOR UPDATE TO public USING (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      )) WITH CHECK (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
CREATE POLICY "dish_promotions_update_service" ON "dish_promotions" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "dish_promotions_delete_own" ON "dish_promotions" AS PERMISSIVE FOR DELETE TO public USING (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
ALTER POLICY "dish_ingredients_select_public" ON "dish_ingredients" TO public USING (dish_id IN (
  SELECT id FROM dishes WHERE status = 'active'
));--> statement-breakpoint
ALTER POLICY "dish_nutrition_select_public" ON "dish_nutrition" TO public USING (dish_id IN (
  SELECT id FROM dishes WHERE status = 'active'
));--> statement-breakpoint
ALTER POLICY "dish_photos_select_public" ON "dish_photos" TO public USING (dish_id IN (
  SELECT id FROM dishes WHERE status = 'active'
));--> statement-breakpoint
ALTER POLICY "dish_tags_select_public" ON "dish_tags" TO public USING (dish_id IN (
        SELECT id FROM dishes WHERE status = 'active'
      ));--> statement-breakpoint
ALTER POLICY "dishes_select_public" ON "dishes" TO public USING (status = 'active');--> statement-breakpoint
ALTER POLICY "orders_insert_client" ON "orders" TO public WITH CHECK (client_id = auth.uid() AND status = 'pending');--> statement-breakpoint
ALTER POLICY "reviews_insert_client" ON "reviews" TO public WITH CHECK (
        client_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.id = reviews.order_id
            AND o.client_id = auth.uid()
            AND o.status = 'fulfilled'
            AND o.cook_id = reviews.cook_id
        )
      );