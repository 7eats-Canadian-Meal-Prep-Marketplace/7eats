CREATE TYPE "public"."dish_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('one_time', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."promotion_type" AS ENUM('percentage_off', 'fixed_off', 'buy_x_get_y');--> statement-breakpoint
CREATE TABLE "dish_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dish_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"quantity" varchar(100),
	"is_allergen" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dish_ingredients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dish_nutrition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dish_id" uuid NOT NULL,
	"calories" integer,
	"protein_g" numeric(6, 2),
	"carbs_g" numeric(6, 2),
	"fat_g" numeric(6, 2),
	"saturated_fat_g" numeric(6, 2),
	"fiber_g" numeric(6, 2),
	"sugar_g" numeric(6, 2),
	"sodium_mg" numeric(8, 2),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dish_nutrition_dish_id_unique" UNIQUE("dish_id"),
	CONSTRAINT "nutrition_calories_positive" CHECK ("dish_nutrition"."calories" IS NULL OR "dish_nutrition"."calories" >= 0),
	CONSTRAINT "nutrition_protein_positive" CHECK ("dish_nutrition"."protein_g" IS NULL OR "dish_nutrition"."protein_g" >= 0),
	CONSTRAINT "nutrition_carbs_positive" CHECK ("dish_nutrition"."carbs_g" IS NULL OR "dish_nutrition"."carbs_g" >= 0),
	CONSTRAINT "nutrition_fat_positive" CHECK ("dish_nutrition"."fat_g" IS NULL OR "dish_nutrition"."fat_g" >= 0),
	CONSTRAINT "nutrition_satfat_positive" CHECK ("dish_nutrition"."saturated_fat_g" IS NULL OR "dish_nutrition"."saturated_fat_g" >= 0),
	CONSTRAINT "nutrition_fiber_positive" CHECK ("dish_nutrition"."fiber_g" IS NULL OR "dish_nutrition"."fiber_g" >= 0),
	CONSTRAINT "nutrition_sugar_positive" CHECK ("dish_nutrition"."sugar_g" IS NULL OR "dish_nutrition"."sugar_g" >= 0),
	CONSTRAINT "nutrition_sodium_positive" CHECK ("dish_nutrition"."sodium_mg" IS NULL OR "dish_nutrition"."sodium_mg" >= 0)
);
--> statement-breakpoint
ALTER TABLE "dish_nutrition" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dish_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dish_id" uuid NOT NULL,
	"url" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dish_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dish_tags" (
	"dish_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "dish_tags_dish_id_tag_id_pk" PRIMARY KEY("dish_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "dish_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"cuisine" varchar(100),
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_halal" boolean DEFAULT false NOT NULL,
	"is_vegan" boolean DEFAULT false NOT NULL,
	"is_vegetarian" boolean DEFAULT false NOT NULL,
	"is_gluten_free" boolean DEFAULT false NOT NULL,
	"is_dairy_free" boolean DEFAULT false NOT NULL,
	"is_nut_free" boolean DEFAULT false NOT NULL,
	"is_kosher" boolean DEFAULT false NOT NULL,
	"serving_size" varchar(100),
	"status" "dish_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dishes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listing_dishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"dish_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "listing_dishes_quantity_positive" CHECK ("listing_dishes"."quantity" >= 1)
);
--> statement-breakpoint
ALTER TABLE "listing_dishes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listing_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"type" "promotion_type" NOT NULL,
	"value" numeric(10, 2),
	"buy_qty" integer,
	"get_qty" integer,
	"minimum_qty" integer DEFAULT 1 NOT NULL,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promo_value_positive" CHECK ("listing_promotions"."value" IS NULL OR "listing_promotions"."value" > 0),
	CONSTRAINT "promo_percentage_max" CHECK ("listing_promotions"."type" != 'percentage_off' OR ("listing_promotions"."value" IS NOT NULL AND "listing_promotions"."value" <= 100)),
	CONSTRAINT "promo_fixed_requires_value" CHECK ("listing_promotions"."type" != 'fixed_off' OR "listing_promotions"."value" IS NOT NULL),
	CONSTRAINT "promo_bxgy_fields" CHECK ("listing_promotions"."type" != 'buy_x_get_y' OR (
        "listing_promotions"."buy_qty" IS NOT NULL AND "listing_promotions"."get_qty" IS NOT NULL
        AND "listing_promotions"."buy_qty" >= 1 AND "listing_promotions"."get_qty" >= 1
      )),
	CONSTRAINT "promo_minimum_qty_positive" CHECK ("listing_promotions"."minimum_qty" >= 1),
	CONSTRAINT "promo_max_uses_positive" CHECK ("listing_promotions"."max_uses" IS NULL OR "listing_promotions"."max_uses" >= 1),
	CONSTRAINT "promo_uses_count_non_negative" CHECK ("listing_promotions"."uses_count" >= 0),
	CONSTRAINT "promo_uses_count_cap" CHECK ("listing_promotions"."max_uses" IS NULL OR "listing_promotions"."uses_count" <= "listing_promotions"."max_uses"),
	CONSTRAINT "promo_dates_order" CHECK ("listing_promotions"."valid_from" IS NULL OR "listing_promotions"."valid_until" IS NULL OR "listing_promotions"."valid_until" > "listing_promotions"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "listing_promotions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_dishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"dish_id" uuid NOT NULL,
	"dish_name" varchar(255) NOT NULL,
	"quantity" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "order_dishes_quantity_positive" CHECK ("order_dishes"."quantity" >= 1)
);
--> statement-breakpoint
ALTER TABLE "order_dishes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "ingredients_select_active_listing" ON "listing_ingredients" CASCADE;--> statement-breakpoint
DROP POLICY "ingredients_select_own" ON "listing_ingredients" CASCADE;--> statement-breakpoint
DROP POLICY "ingredients_insert_own" ON "listing_ingredients" CASCADE;--> statement-breakpoint
DROP POLICY "ingredients_update_own" ON "listing_ingredients" CASCADE;--> statement-breakpoint
DROP POLICY "ingredients_delete_own" ON "listing_ingredients" CASCADE;--> statement-breakpoint
DROP TABLE "listing_ingredients" CASCADE;--> statement-breakpoint
DROP POLICY "nutrition_select_active_listing" ON "listing_nutrition" CASCADE;--> statement-breakpoint
DROP POLICY "nutrition_select_own" ON "listing_nutrition" CASCADE;--> statement-breakpoint
DROP POLICY "nutrition_insert_own" ON "listing_nutrition" CASCADE;--> statement-breakpoint
DROP POLICY "nutrition_update_own" ON "listing_nutrition" CASCADE;--> statement-breakpoint
DROP TABLE "listing_nutrition" CASCADE;--> statement-breakpoint
DROP POLICY "photos_select_active_listing" ON "listing_photos" CASCADE;--> statement-breakpoint
DROP POLICY "photos_select_own" ON "listing_photos" CASCADE;--> statement-breakpoint
DROP POLICY "photos_insert_own" ON "listing_photos" CASCADE;--> statement-breakpoint
DROP POLICY "photos_update_own" ON "listing_photos" CASCADE;--> statement-breakpoint
DROP POLICY "photos_delete_own" ON "listing_photos" CASCADE;--> statement-breakpoint
DROP TABLE "listing_photos" CASCADE;--> statement-breakpoint
DROP POLICY "listing_tags_select_all" ON "listing_tags" CASCADE;--> statement-breakpoint
DROP POLICY "listing_tags_insert_own" ON "listing_tags" CASCADE;--> statement-breakpoint
DROP POLICY "listing_tags_delete_own" ON "listing_tags" CASCADE;--> statement-breakpoint
DROP TABLE "listing_tags" CASCADE;--> statement-breakpoint
DROP POLICY "otps_service_only" ON "phone_otps" CASCADE;--> statement-breakpoint
DROP TABLE "phone_otps" CASCADE;--> statement-breakpoint
DROP POLICY "users_select_own" ON "users" CASCADE;--> statement-breakpoint
DROP POLICY "users_select_admin" ON "users" CASCADE;--> statement-breakpoint
DROP POLICY "users_update_own" ON "users" CASCADE;--> statement-breakpoint
DROP POLICY "users_insert_service" ON "users" CASCADE;--> statement-breakpoint
DROP POLICY "users_delete_admin" ON "users" CASCADE;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
ALTER TABLE "cook_certifications" DROP CONSTRAINT "cook_certifications_reviewed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cook_profiles" DROP CONSTRAINT "cook_profiles_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cook_profiles" DROP CONSTRAINT "cook_profiles_reviewed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "listings" DROP CONSTRAINT "listings_reviewed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_client_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_cancelled_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_client_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cook_certifications" ALTER COLUMN "reviewed_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cook_profiles" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cook_profiles" ALTER COLUMN "reviewed_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "reviewed_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "client_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "cancelled_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "client_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" "user_role" DEFAULT 'cook' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_name" varchar(100);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_name" varchar(100);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "type" "listing_type" DEFAULT 'one_time' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "cover_photo_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "promotion_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_nutrition" ADD CONSTRAINT "dish_nutrition_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_photos" ADD CONSTRAINT "dish_photos_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_tags" ADD CONSTRAINT "dish_tags_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_tags" ADD CONSTRAINT "dish_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_dishes" ADD CONSTRAINT "listing_dishes_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_dishes" ADD CONSTRAINT "listing_dishes_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_promotions" ADD CONSTRAINT "listing_promotions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_dishes" ADD CONSTRAINT "order_dishes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_dishes" ADD CONSTRAINT "order_dishes_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_dishes_listing_dish_uidx" ON "listing_dishes" USING btree ("listing_id","dish_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_dishes_order_dish_uidx" ON "order_dishes" USING btree ("order_id","dish_id");--> statement-breakpoint
ALTER TABLE "cook_certifications" ADD CONSTRAINT "cook_certifications_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_promotion_id_listing_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."listing_promotions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN "portion_size";--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_base_price_positive" CHECK ("listings"."base_price" > 0);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_min_order_qty_positive" CHECK ("listings"."min_order_qty" >= 1);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_max_order_qty_valid" CHECK ("listings"."max_order_qty" IS NULL OR "listings"."max_order_qty" >= "listings"."min_order_qty");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_positive" CHECK ("orders"."quantity" >= 1);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_unit_price_positive" CHECK ("orders"."unit_price" > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_non_negative" CHECK ("orders"."discount_amount" IS NULL OR "orders"."discount_amount" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_price_non_negative" CHECK ("orders"."total_price" >= 0);--> statement-breakpoint
CREATE POLICY "dish_ingredients_select_public" ON "dish_ingredients" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
  SELECT ld.dish_id FROM listing_dishes ld
  JOIN listings l ON l.id = ld.listing_id
  WHERE l.status = 'active'
));--> statement-breakpoint
CREATE POLICY "dish_ingredients_select_own" ON "dish_ingredients" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dish_ingredients_insert_own" ON "dish_ingredients" AS PERMISSIVE FOR INSERT TO public WITH CHECK (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dish_ingredients_update_own" ON "dish_ingredients" AS PERMISSIVE FOR UPDATE TO public USING (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
)) WITH CHECK (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dish_ingredients_delete_own" ON "dish_ingredients" AS PERMISSIVE FOR DELETE TO public USING (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dish_nutrition_select_public" ON "dish_nutrition" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
  SELECT ld.dish_id FROM listing_dishes ld
  JOIN listings l ON l.id = ld.listing_id
  WHERE l.status = 'active'
));--> statement-breakpoint
CREATE POLICY "dish_nutrition_select_own" ON "dish_nutrition" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dish_nutrition_insert_own" ON "dish_nutrition" AS PERMISSIVE FOR INSERT TO public WITH CHECK (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dish_nutrition_update_own" ON "dish_nutrition" AS PERMISSIVE FOR UPDATE TO public USING (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
)) WITH CHECK (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dish_photos_select_public" ON "dish_photos" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
  SELECT ld.dish_id FROM listing_dishes ld
  JOIN listings l ON l.id = ld.listing_id
  WHERE l.status = 'active'
));--> statement-breakpoint
CREATE POLICY "dish_photos_select_own" ON "dish_photos" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dish_photos_insert_own" ON "dish_photos" AS PERMISSIVE FOR INSERT TO public WITH CHECK (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dish_photos_update_own" ON "dish_photos" AS PERMISSIVE FOR UPDATE TO public USING (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
)) WITH CHECK (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dish_photos_delete_own" ON "dish_photos" AS PERMISSIVE FOR DELETE TO public USING (dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dish_tags_select_public" ON "dish_tags" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
        SELECT ld.dish_id FROM listing_dishes ld
        JOIN listings l ON l.id = ld.listing_id
        WHERE l.status = 'active'
      ));--> statement-breakpoint
CREATE POLICY "dish_tags_select_own" ON "dish_tags" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "dish_tags_insert_own" ON "dish_tags" AS PERMISSIVE FOR INSERT TO public WITH CHECK (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "dish_tags_delete_own" ON "dish_tags" AS PERMISSIVE FOR DELETE TO public USING (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "dishes_select_public" ON "dishes" AS PERMISSIVE FOR SELECT TO public USING (id IN (
  SELECT ld.dish_id FROM listing_dishes ld
  JOIN listings l ON l.id = ld.listing_id
  WHERE l.status = 'active'
));--> statement-breakpoint
CREATE POLICY "dishes_select_own" ON "dishes" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dishes_select_admin" ON "dishes" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "dishes_insert_own" ON "dishes" AS PERMISSIVE FOR INSERT TO public WITH CHECK (cook_id IN (
        SELECT id FROM cook_profiles WHERE user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "dishes_update_own" ON "dishes" AS PERMISSIVE FOR UPDATE TO public USING (cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()
)) WITH CHECK (cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "dishes_update_admin" ON "dishes" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "listing_dishes_select_public" ON "listing_dishes" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (SELECT id FROM listings WHERE status = 'active'));--> statement-breakpoint
CREATE POLICY "listing_dishes_select_own" ON "listing_dishes" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "listing_dishes_select_admin" ON "listing_dishes" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "listing_dishes_insert_own" ON "listing_dishes" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        listing_id IN (
          SELECT l.id FROM listings l
          JOIN cook_profiles cp ON l.cook_id = cp.id
          WHERE cp.user_id = auth.uid()
        )
        AND dish_id IN (
          SELECT d.id FROM dishes d
          JOIN cook_profiles cp ON d.cook_id = cp.id
          WHERE cp.user_id = auth.uid()
        )
      );--> statement-breakpoint
CREATE POLICY "listing_dishes_update_own" ON "listing_dishes" AS PERMISSIVE FOR UPDATE TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )) WITH CHECK (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "listing_dishes_delete_own" ON "listing_dishes" AS PERMISSIVE FOR DELETE TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "listing_promotions_select_public" ON "listing_promotions" AS PERMISSIVE FOR SELECT TO public USING (
        is_active = TRUE
        AND listing_id IN (SELECT id FROM listings WHERE status = 'active')
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until > NOW())
        AND (max_uses IS NULL OR uses_count < max_uses)
      );--> statement-breakpoint
CREATE POLICY "listing_promotions_select_own" ON "listing_promotions" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "listing_promotions_select_admin" ON "listing_promotions" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "listing_promotions_insert_own" ON "listing_promotions" AS PERMISSIVE FOR INSERT TO public WITH CHECK (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "listing_promotions_update_own" ON "listing_promotions" AS PERMISSIVE FOR UPDATE TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "listing_promotions_update_service" ON "listing_promotions" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "listing_promotions_delete_own" ON "listing_promotions" AS PERMISSIVE FOR DELETE TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "order_dishes_select_client" ON "order_dishes" AS PERMISSIVE FOR SELECT TO public USING (order_id IN (SELECT id FROM orders WHERE client_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "order_dishes_select_cook" ON "order_dishes" AS PERMISSIVE FOR SELECT TO public USING (order_id IN (
        SELECT o.id FROM orders o
        JOIN cook_profiles cp ON o.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "order_dishes_select_admin" ON "order_dishes" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "order_dishes_insert_service" ON "order_dishes" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
ALTER POLICY "cook_profiles_select_active" ON "cook_profiles" TO public USING (EXISTS (SELECT 1 FROM "user" u WHERE u.id = cook_profiles.user_id AND u.status = 'active'));--> statement-breakpoint
ALTER POLICY "listings_select_own" ON "listings" TO public USING (cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()
));--> statement-breakpoint
ALTER POLICY "listings_update_own" ON "listings" TO public USING (cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()
)) WITH CHECK (cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()
));--> statement-breakpoint
ALTER POLICY "orders_insert_client" ON "orders" TO public WITH CHECK (
        client_id = auth.uid()
        AND status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM listings l
          WHERE l.id = orders.listing_id
            AND l.status = 'active'
            AND l.cook_id = orders.cook_id
            AND l.base_price = orders.unit_price
        )
        AND orders.total_price = orders.unit_price * orders.quantity - COALESCE(orders.discount_amount, 0)
        AND (
          orders.promotion_id IS NULL
          OR EXISTS (
            SELECT 1 FROM listing_promotions lp
            WHERE lp.id = orders.promotion_id
              AND lp.listing_id = orders.listing_id
              AND lp.is_active = TRUE
              AND (lp.valid_from IS NULL OR lp.valid_from <= NOW())
              AND (lp.valid_until IS NULL OR lp.valid_until > NOW())
              AND (lp.max_uses IS NULL OR lp.uses_count < lp.max_uses)
          )
        )
      );