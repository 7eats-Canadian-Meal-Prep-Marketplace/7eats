CREATE TYPE "public"."account_status" AS ENUM('pending', 'active', 'suspended', 'banned');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."certification_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."delivery_enum" AS ENUM('none', 'self');--> statement-breakpoint
CREATE TYPE "public"."kitchen_type" AS ENUM('licensed_home', 'commercial_rented', 'ghost_kitchen', 'restaurant_cafe', 'community_kitchen', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_time_enum" AS ENUM('same_day', '1_day', '2_days', '3_days', '4_days', '5_days');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_review', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'ready', 'fulfilled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client', 'cook', 'admin');--> statement-breakpoint
CREATE TABLE "cook_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kitchen_name" text NOT NULL,
	"kitchen_type" "kitchen_type" NOT NULL,
	"years_operating" text NOT NULL,
	"street_address" text NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"postal_code" text NOT NULL,
	"website" text,
	"business_phone" text NOT NULL,
	"business_email" text NOT NULL,
	"contact_first_name" text NOT NULL,
	"contact_last_name" text NOT NULL,
	"contact_role" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_email" text NOT NULL,
	"status" "application_status" DEFAULT 'pending_review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cook_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "setup_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "setup_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "setup_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cook_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"holder_name" text NOT NULL,
	"issuer" varchar(255),
	"certificate_number" varchar(100),
	"province" varchar(50),
	"issued_at" timestamp,
	"expires_at" timestamp,
	"file_url" text,
	"status" "certification_status" DEFAULT 'pending_review' NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" uuid,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cook_certifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cook_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"photo_url" text,
	"social_link" text,
	"current_setup_step" integer DEFAULT 1 NOT NULL,
	"setup_complete" boolean DEFAULT false NOT NULL,
	"pickup_address" text,
	"pickup_days" text[],
	"pickup_from" text,
	"pickup_to" text,
	"lead_time" "lead_time_enum",
	"max_capacity" integer,
	"delivery" "delivery_enum",
	"accepts_special_requests" boolean DEFAULT false NOT NULL,
	"stripe_account_id" text,
	"tos_accepted_at" timestamp with time zone,
	"reviewed_at" timestamp,
	"reviewed_by" uuid,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cook_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "cook_profiles_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
ALTER TABLE "cook_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listing_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"quantity" varchar(100),
	"is_allergen" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_ingredients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listing_nutrition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"calories" integer,
	"protein_g" numeric(6, 2),
	"carbs_g" numeric(6, 2),
	"fat_g" numeric(6, 2),
	"fiber_g" numeric(6, 2),
	"sodium_mg" numeric(8, 2),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "listing_nutrition_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
ALTER TABLE "listing_nutrition" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"url" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listing_tags" (
	"listing_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "listing_tags_listing_id_tag_id_pk" PRIMARY KEY("listing_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "listing_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"base_price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"portion_size" varchar(100),
	"min_order_qty" integer DEFAULT 1 NOT NULL,
	"max_order_qty" integer,
	"reviewed_at" timestamp,
	"reviewed_by" uuid,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"cook_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"pickup_at" timestamp NOT NULL,
	"fulfilled_at" timestamp,
	"cancelled_at" timestamp,
	"cancelled_by" uuid,
	"late_cancel_fee" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"cook_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cook_profile_tags" (
	"cook_profile_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "cook_profile_tags_cook_profile_id_tag_id_pk" PRIMARY KEY("cook_profile_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "cook_profile_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"category" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "phone_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"phone" varchar(20) NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "phone_otps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"phone" varchar(20),
	"phone_verified" boolean DEFAULT false NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "waitlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD CONSTRAINT "setup_tokens_application_id_cook_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."cook_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_certifications" ADD CONSTRAINT "cook_certifications_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_certifications" ADD CONSTRAINT "cook_certifications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_application_id_cook_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."cook_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_ingredients" ADD CONSTRAINT "listing_ingredients_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_nutrition" ADD CONSTRAINT "listing_nutrition_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_tags" ADD CONSTRAINT "listing_tags_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_tags" ADD CONSTRAINT "listing_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profile_tags" ADD CONSTRAINT "cook_profile_tags_cook_profile_id_cook_profiles_id_fk" FOREIGN KEY ("cook_profile_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profile_tags" ADD CONSTRAINT "cook_profile_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_otps" ADD CONSTRAINT "phone_otps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cook_applications_contact_email_idx" ON "cook_applications" USING btree ("contact_email");--> statement-breakpoint
CREATE POLICY "applications_insert_service" ON "cook_applications" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "applications_select_admin" ON "cook_applications" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "applications_select_service" ON "cook_applications" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "applications_update_admin" ON "cook_applications" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "applications_update_service" ON "cook_applications" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "setup_tokens_service_only" ON "setup_tokens" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "certs_select_own" ON "cook_certifications" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "certs_select_approved" ON "cook_certifications" AS PERMISSIVE FOR SELECT TO public USING (status = 'approved');--> statement-breakpoint
CREATE POLICY "certs_select_admin" ON "cook_certifications" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "certs_insert_own" ON "cook_certifications" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())
        AND status = 'pending_review'
        AND reviewed_at IS NULL
        AND reviewed_by IS NULL
        AND review_notes IS NULL
      );--> statement-breakpoint
CREATE POLICY "certs_update_admin" ON "cook_certifications" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "certs_delete_own_pending" ON "cook_certifications" AS PERMISSIVE FOR DELETE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()) AND status = 'pending_review');--> statement-breakpoint
CREATE POLICY "cook_profiles_select_active" ON "cook_profiles" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (SELECT 1 FROM users u WHERE u.id = cook_profiles.user_id AND u.status = 'active'));--> statement-breakpoint
CREATE POLICY "cook_profiles_update_own" ON "cook_profiles" AS PERMISSIVE FOR UPDATE TO public USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "cook_profiles_insert_service" ON "cook_profiles" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "cook_profiles_update_admin" ON "cook_profiles" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "ingredients_select_active_listing" ON "listing_ingredients" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (SELECT id FROM listings WHERE status = 'active'));--> statement-breakpoint
CREATE POLICY "ingredients_select_own" ON "listing_ingredients" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "ingredients_insert_own" ON "listing_ingredients" AS PERMISSIVE FOR INSERT TO public WITH CHECK (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "ingredients_update_own" ON "listing_ingredients" AS PERMISSIVE FOR UPDATE TO public USING (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "ingredients_delete_own" ON "listing_ingredients" AS PERMISSIVE FOR DELETE TO public USING (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "nutrition_select_active_listing" ON "listing_nutrition" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (SELECT id FROM listings WHERE status = 'active'));--> statement-breakpoint
CREATE POLICY "nutrition_select_own" ON "listing_nutrition" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "nutrition_insert_own" ON "listing_nutrition" AS PERMISSIVE FOR INSERT TO public WITH CHECK (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "nutrition_update_own" ON "listing_nutrition" AS PERMISSIVE FOR UPDATE TO public USING (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "photos_select_active_listing" ON "listing_photos" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (SELECT id FROM listings WHERE status = 'active'));--> statement-breakpoint
CREATE POLICY "photos_select_own" ON "listing_photos" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "photos_insert_own" ON "listing_photos" AS PERMISSIVE FOR INSERT TO public WITH CHECK (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "photos_update_own" ON "listing_photos" AS PERMISSIVE FOR UPDATE TO public USING (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "photos_delete_own" ON "listing_photos" AS PERMISSIVE FOR DELETE TO public USING (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "listing_tags_select_all" ON "listing_tags" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (SELECT id FROM listings WHERE status = 'active'));--> statement-breakpoint
CREATE POLICY "listing_tags_insert_own" ON "listing_tags" AS PERMISSIVE FOR INSERT TO public WITH CHECK (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "listing_tags_delete_own" ON "listing_tags" AS PERMISSIVE FOR DELETE TO public USING (listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "listings_select_active" ON "listings" AS PERMISSIVE FOR SELECT TO public USING (status = 'active');--> statement-breakpoint
CREATE POLICY "listings_select_own" ON "listings" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "listings_select_admin" ON "listings" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "listings_insert_own" ON "listings" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())
        AND status = 'draft'
        AND reviewed_at IS NULL
        AND reviewed_by IS NULL
        AND review_notes IS NULL
      );--> statement-breakpoint
CREATE POLICY "listings_update_own" ON "listings" AS PERMISSIVE FOR UPDATE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())) WITH CHECK (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "listings_update_admin" ON "listings" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "listings_delete_own_draft" ON "listings" AS PERMISSIVE FOR DELETE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()) AND status = 'draft');--> statement-breakpoint
CREATE POLICY "orders_select_client" ON "orders" AS PERMISSIVE FOR SELECT TO public USING (client_id = auth.uid());--> statement-breakpoint
CREATE POLICY "orders_select_cook" ON "orders" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "orders_select_admin" ON "orders" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "orders_insert_client" ON "orders" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
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
        AND orders.total_price = orders.unit_price * orders.quantity
      );--> statement-breakpoint
CREATE POLICY "orders_update_client" ON "orders" AS PERMISSIVE FOR UPDATE TO public USING (client_id = auth.uid() AND status = 'pending') WITH CHECK (client_id = auth.uid() AND status IN ('pending', 'cancelled'));--> statement-breakpoint
CREATE POLICY "orders_update_cook" ON "orders" AS PERMISSIVE FOR UPDATE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()) AND status IN ('pending', 'confirmed', 'ready')) WITH CHECK (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()) AND status IN ('confirmed', 'ready', 'fulfilled', 'cancelled'));--> statement-breakpoint
CREATE POLICY "orders_update_admin" ON "orders" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "reviews_select_visible" ON "reviews" AS PERMISSIVE FOR SELECT TO public USING (is_visible = TRUE);--> statement-breakpoint
CREATE POLICY "reviews_select_own" ON "reviews" AS PERMISSIVE FOR SELECT TO public USING (client_id = auth.uid() OR cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "reviews_select_admin" ON "reviews" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "reviews_insert_client" ON "reviews" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        client_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.id = reviews.order_id
            AND o.client_id = auth.uid()
            AND o.status = 'fulfilled'
            AND o.cook_id = reviews.cook_id
            AND o.listing_id = reviews.listing_id
        )
      );--> statement-breakpoint
CREATE POLICY "reviews_update_own" ON "reviews" AS PERMISSIVE FOR UPDATE TO public USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());--> statement-breakpoint
CREATE POLICY "reviews_update_admin" ON "reviews" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "cook_profile_tags_select_public" ON "cook_profile_tags" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "cook_profile_tags_insert_own" ON "cook_profile_tags" AS PERMISSIVE FOR INSERT TO public WITH CHECK (cook_profile_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "cook_profile_tags_delete_own" ON "cook_profile_tags" AS PERMISSIVE FOR DELETE TO public USING (cook_profile_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "tags_select_all" ON "tags" AS PERMISSIVE FOR SELECT TO public USING (TRUE);--> statement-breakpoint
CREATE POLICY "tags_insert_admin" ON "tags" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "tags_update_admin" ON "tags" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "tags_delete_admin" ON "tags" AS PERMISSIVE FOR DELETE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "otps_service_only" ON "phone_otps" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "users_select_own" ON "users" AS PERMISSIVE FOR SELECT TO public USING (id = auth.uid());--> statement-breakpoint
CREATE POLICY "users_select_admin" ON "users" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "users_update_own" ON "users" AS PERMISSIVE FOR UPDATE TO public USING (id = auth.uid()) WITH CHECK (id = auth.uid());--> statement-breakpoint
CREATE POLICY "users_insert_service" ON "users" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "users_delete_admin" ON "users" AS PERMISSIVE FOR DELETE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "rate_limit_log_service_only" ON "rate_limit_log" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "waitlist_service_only" ON "waitlist" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');