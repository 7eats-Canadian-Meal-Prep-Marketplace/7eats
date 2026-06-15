CREATE TYPE "public"."account_status" AS ENUM('pending', 'active', 'suspended', 'banned');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."certification_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."delivery_enum" AS ENUM('none', 'self');--> statement-breakpoint
CREATE TYPE "public"."dish_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."kitchen_type" AS ENUM('licensed_home', 'commercial_rented', 'ghost_kitchen', 'restaurant_cafe', 'community_kitchen', 'other');--> statement-breakpoint
CREATE TYPE "public"."late_cancel_fee_type" AS ENUM('flat', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."lead_time_enum" AS ENUM('same_day', '1_day', '2_days', '3_days', '4_days', '5_days');--> statement-breakpoint
CREATE TYPE "public"."legal_acceptance_context" AS ENUM('client_signup', 'guest_checkout', 'cook_application');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_review', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('one_time', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."notification_entity_type" AS ENUM('order_new', 'order_cancelled', 'review');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'ready', 'fulfilled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'authorized', 'held', 'released', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('full', 'deposit', 'balance');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'in_transit', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."promotion_type" AS ENUM('percentage_off', 'fixed_off');--> statement-breakpoint
CREATE TYPE "public"."subscription_interval" AS ENUM('weekly', 'biweekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'cancelled', 'past_due');--> statement-breakpoint
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
	"address_lat" double precision,
	"address_lng" double precision,
	"address_place_id" text,
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
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"role" "user_role" DEFAULT 'cook' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"phone" varchar(20),
	"phone_verified" boolean DEFAULT false NOT NULL,
	"stripe_customer_id" text,
	"onboarding_completed_at" timestamp,
	"is_guest_account" boolean DEFAULT false NOT NULL,
	"date_of_birth" date,
	"neighborhood" varchar(100),
	"notification_preferences" jsonb,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cook_pickup_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"day_of_week" text NOT NULL,
	"from_time" time(0) NOT NULL,
	"to_time" time(0) NOT NULL,
	CONSTRAINT "cpw_time_order" CHECK ("cook_pickup_windows"."to_time" > "cook_pickup_windows"."from_time"),
	CONSTRAINT "cpw_day_valid" CHECK ("cook_pickup_windows"."day_of_week" IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday'))
);
--> statement-breakpoint
ALTER TABLE "cook_pickup_windows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
	"reviewed_by" text,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cook_certifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cook_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"application_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"photo_url" text,
	"social_link" text,
	"current_setup_step" integer DEFAULT 1 NOT NULL,
	"setup_complete" boolean DEFAULT false NOT NULL,
	"pickup_address" text,
	"pickup_street" text,
	"pickup_unit" text,
	"pickup_city" text,
	"pickup_province" text,
	"pickup_postal" text,
	"pickup_lat" double precision,
	"pickup_lng" double precision,
	"pickup_place_id" text,
	"max_delivery_km" integer,
	"delivery_rate_per_km" numeric(6, 2),
	"delivery_flat_fee" numeric(6, 2) DEFAULT '0',
	"free_delivery_above" numeric(8, 2),
	"lead_time" "lead_time_enum",
	"max_capacity" integer,
	"delivery" "delivery_enum",
	"accepts_special_requests" boolean DEFAULT false NOT NULL,
	"stripe_account_id" text,
	"platform_fee_pct" numeric(5, 2) DEFAULT '7.5' NOT NULL,
	"late_cancel_fee_enabled" boolean DEFAULT false NOT NULL,
	"late_cancel_fee_type" "late_cancel_fee_type",
	"late_cancel_fee_value" numeric(10, 2),
	"late_cancel_window_hours" integer DEFAULT 24 NOT NULL,
	"tos_accepted_at" timestamp with time zone,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"email_notifications_new_order" boolean DEFAULT true NOT NULL,
	"email_notifications_new_review" boolean DEFAULT true NOT NULL,
	"sms_notifications_new_order" boolean DEFAULT false NOT NULL,
	CONSTRAINT "cook_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "cook_profiles_application_id_unique" UNIQUE("application_id"),
	CONSTRAINT "cook_profiles_fee_pct_valid" CHECK ("cook_profiles"."platform_fee_pct" > 0 AND "cook_profiles"."platform_fee_pct" <= 100),
	CONSTRAINT "cook_profiles_late_cancel_fee_positive" CHECK ("cook_profiles"."late_cancel_fee_value" IS NULL OR "cook_profiles"."late_cancel_fee_value" > 0),
	CONSTRAINT "cook_profiles_late_cancel_window_positive" CHECK ("cook_profiles"."late_cancel_window_hours" >= 1)
);
--> statement-breakpoint
ALTER TABLE "cook_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
CREATE TABLE "legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"application_id" uuid,
	"context" "legal_acceptance_context" NOT NULL,
	"version" text NOT NULL,
	"documents" jsonb NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_acceptances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
	CONSTRAINT "promo_minimum_qty_positive" CHECK ("listing_promotions"."minimum_qty" >= 1),
	CONSTRAINT "promo_max_uses_positive" CHECK ("listing_promotions"."max_uses" IS NULL OR "listing_promotions"."max_uses" >= 1),
	CONSTRAINT "promo_uses_count_non_negative" CHECK ("listing_promotions"."uses_count" >= 0),
	CONSTRAINT "promo_uses_count_cap" CHECK ("listing_promotions"."max_uses" IS NULL OR "listing_promotions"."uses_count" <= "listing_promotions"."max_uses"),
	CONSTRAINT "promo_dates_order" CHECK ("listing_promotions"."valid_from" IS NULL OR "listing_promotions"."valid_until" IS NULL OR "listing_promotions"."valid_until" > "listing_promotions"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "listing_promotions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" "listing_type" DEFAULT 'one_time' NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"base_price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"fulfillment" varchar(20) DEFAULT 'pickup' NOT NULL,
	"subscription_enabled" boolean DEFAULT false NOT NULL,
	"subscription_interval" "subscription_interval",
	"commitment_periods" integer,
	"cover_photo_url" text,
	"stripe_product_id" text,
	"min_order_qty" integer DEFAULT 1 NOT NULL,
	"max_order_qty" integer,
	"cancellation_notice_days" integer,
	"deposit_enabled" boolean DEFAULT false NOT NULL,
	"deposit_type" "late_cancel_fee_type",
	"deposit_value" numeric(10, 2),
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "listings_fulfillment_valid" CHECK ("listings"."fulfillment" IN ('pickup', 'delivery', 'both')),
	CONSTRAINT "listings_base_price_positive" CHECK ("listings"."base_price" > 0),
	CONSTRAINT "listings_min_order_qty_positive" CHECK ("listings"."min_order_qty" >= 1),
	CONSTRAINT "listings_max_order_qty_valid" CHECK ("listings"."max_order_qty" IS NULL OR "listings"."max_order_qty" >= "listings"."min_order_qty"),
	CONSTRAINT "listings_cancellation_notice_days_non_negative" CHECK ("listings"."cancellation_notice_days" IS NULL OR "listings"."cancellation_notice_days" >= 0),
	CONSTRAINT "listings_deposit_value_positive" CHECK ("listings"."deposit_value" IS NULL OR "listings"."deposit_value" > 0)
);
--> statement-breakpoint
ALTER TABLE "listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"order_id" uuid,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_role" text NOT NULL,
	"body" text NOT NULL,
	"is_read_by_cook" boolean DEFAULT false NOT NULL,
	"is_read_by_client" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cook_notification_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"entity_type" "notification_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cook_notification_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"cook_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"promotion_id" uuid,
	"discount_amount" numeric(10, 2),
	"total_price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"pickup_at" timestamp,
	"delivery_address" jsonb,
	"delivery_fee_snapshot" numeric(8, 2),
	"delivery_distance_km" integer,
	"fulfillment_mode" varchar(20),
	"fulfilled_at" timestamp,
	"cancelled_at" timestamp,
	"cancelled_by" text,
	"late_cancel_fee" numeric(10, 2),
	"notes" text,
	"subscription_id" uuid,
	"pickup_code_hash" text,
	"pickup_code_expires_at" timestamp,
	"pickup_code_verified_at" timestamp,
	"pickup_code_attempts" integer DEFAULT 0 NOT NULL,
	"pickup_code" text,
	"late_cancel_fee_enabled" boolean DEFAULT false NOT NULL,
	"late_cancel_fee_type" "late_cancel_fee_type",
	"late_cancel_fee_value" numeric(10, 2),
	"late_cancel_window_hours" integer,
	"late_cancel_fee_applied" numeric(10, 2),
	"deposit_enabled" boolean DEFAULT false NOT NULL,
	"deposit_type" "late_cancel_fee_type",
	"deposit_value" numeric(10, 2),
	"deposit_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_quantity_positive" CHECK ("orders"."quantity" >= 1),
	CONSTRAINT "orders_unit_price_positive" CHECK ("orders"."unit_price" > 0),
	CONSTRAINT "orders_discount_non_negative" CHECK ("orders"."discount_amount" IS NULL OR "orders"."discount_amount" >= 0),
	CONSTRAINT "orders_total_price_non_negative" CHECK ("orders"."total_price" >= 0),
	CONSTRAINT "orders_pickup_code_attempts_non_negative" CHECK ("orders"."pickup_code_attempts" >= 0),
	CONSTRAINT "orders_late_cancel_fee_applied_non_negative" CHECK ("orders"."late_cancel_fee_applied" IS NULL OR "orders"."late_cancel_fee_applied" >= 0),
	CONSTRAINT "orders_fulfillment_mode_valid" CHECK ("orders"."fulfillment_mode" IS NULL OR "orders"."fulfillment_mode" IN ('pickup', 'delivery'))
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"cook_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"cook_response" text,
	"cook_response_at" timestamp,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cook_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"platform_fee_pct" numeric(5, 2) NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cook_agreements_fee_pct_valid" CHECK ("cook_agreements"."platform_fee_pct" > 0 AND "cook_agreements"."platform_fee_pct" <= 100)
);
--> statement-breakpoint
ALTER TABLE "cook_agreements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cook_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"stripe_payout_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD',
	"status" "payout_status" NOT NULL,
	"arrival_date" timestamp with time zone,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cook_payouts_stripe_payout_id_unique" UNIQUE("stripe_payout_id"),
	CONSTRAINT "cook_payouts_amount_positive" CHECK ("cook_payouts"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "cook_payouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" "payment_type" DEFAULT 'full' NOT NULL,
	"cook_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"platform_fee_pct" numeric(5, 2) NOT NULL,
	"platform_fee_amount" numeric(10, 2),
	"cook_payout_amount" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'CAD',
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"stripe_transfer_id" text,
	"stripe_refund_id" text,
	"authorized_at" timestamp with time zone,
	"held_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_payments_total_amount_positive" CHECK ("order_payments"."total_amount" > 0),
	CONSTRAINT "order_payments_fee_pct_valid" CHECK ("order_payments"."platform_fee_pct" > 0 AND "order_payments"."platform_fee_pct" <= 100)
);
--> statement-breakpoint
ALTER TABLE "order_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dietary" json NOT NULL,
	"allergies" json NOT NULL,
	"goals" json NOT NULL,
	"why_meal_prep" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "followed_cooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"cook_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "followed_cooks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "saved_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
CREATE TABLE "user_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"service_street" text,
	"service_unit" text,
	"service_city" text,
	"service_province" text,
	"service_postal" text,
	"service_lat" double precision,
	"service_lng" double precision,
	"service_place_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_addresses_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
ALTER TABLE "cook_pickup_windows" ADD CONSTRAINT "cook_pickup_windows_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_certifications" ADD CONSTRAINT "cook_certifications_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_certifications" ADD CONSTRAINT "cook_certifications_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_application_id_cook_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."cook_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_nutrition" ADD CONSTRAINT "dish_nutrition_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_photos" ADD CONSTRAINT "dish_photos_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_tags" ADD CONSTRAINT "dish_tags_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_tags" ADD CONSTRAINT "dish_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_application_id_cook_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."cook_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_bundles" ADD CONSTRAINT "listing_bundles_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_dishes" ADD CONSTRAINT "listing_dishes_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_dishes" ADD CONSTRAINT "listing_dishes_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_promotions" ADD CONSTRAINT "listing_promotions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_notification_reads" ADD CONSTRAINT "cook_notification_reads_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_dishes" ADD CONSTRAINT "order_dishes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_dishes" ADD CONSTRAINT "order_dishes_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_promotion_id_listing_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."listing_promotions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscription_id_client_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."client_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_agreements" ADD CONSTRAINT "cook_agreements_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_agreements" ADD CONSTRAINT "cook_agreements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_payouts" ADD CONSTRAINT "cook_payouts_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_cooks" ADD CONSTRAINT "followed_cooks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_cooks" ADD CONSTRAINT "followed_cooks_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_tier_id_listing_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."listing_subscription_tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_subscription_tiers" ADD CONSTRAINT "listing_subscription_tiers_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profile_tags" ADD CONSTRAINT "cook_profile_tags_cook_profile_id_cook_profiles_id_fk" FOREIGN KEY ("cook_profile_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profile_tags" ADD CONSTRAINT "cook_profile_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cook_applications_contact_email_idx" ON "cook_applications" USING btree ("contact_email");--> statement-breakpoint
CREATE UNIQUE INDEX "cpw_cook_day_uidx" ON "cook_pickup_windows" USING btree ("cook_id","day_of_week");--> statement-breakpoint
CREATE INDEX "legal_acceptances_user_id_idx" ON "legal_acceptances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "legal_acceptances_application_id_idx" ON "legal_acceptances" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_bundles_listing_qty_uidx" ON "listing_bundles" USING btree ("listing_id","quantity");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_dishes_listing_dish_uidx" ON "listing_dishes" USING btree ("listing_id","dish_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_cook_client_order_uidx" ON "conversations" USING btree ("cook_id","client_id","order_id") WHERE "conversations"."order_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "conversations_cook_id_idx" ON "conversations" USING btree ("cook_id");--> statement-breakpoint
CREATE INDEX "conversations_last_message_at_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cook_notif_reads_cook_entity_uidx" ON "cook_notification_reads" USING btree ("cook_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_dishes_order_dish_uidx" ON "order_dishes" USING btree ("order_id","dish_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_subscription_period_uidx" ON "orders" USING btree ("subscription_id","pickup_at");--> statement-breakpoint
CREATE UNIQUE INDEX "order_payments_order_type_uidx" ON "order_payments" USING btree ("order_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "followed_cooks_user_cook_uidx" ON "followed_cooks" USING btree ("user_id","cook_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_listings_user_listing_uidx" ON "saved_listings" USING btree ("user_id","listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_interval_uidx" ON "listing_subscription_tiers" USING btree ("listing_id","interval");--> statement-breakpoint
CREATE POLICY "applications_insert_service" ON "cook_applications" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "applications_select_admin" ON "cook_applications" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "applications_select_service" ON "cook_applications" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "applications_update_admin" ON "cook_applications" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "applications_update_service" ON "cook_applications" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "setup_tokens_service_only" ON "setup_tokens" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "account_service_only" ON "account" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "session_service_only" ON "session" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "user_select_own" ON "user" AS PERMISSIVE FOR SELECT TO public USING (id = auth.uid());--> statement-breakpoint
CREATE POLICY "user_select_admin" ON "user" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "user_select_service" ON "user" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "user_insert_service" ON "user" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "user_update_own" ON "user" AS PERMISSIVE FOR UPDATE TO public USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "user_update_admin" ON "user" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "user_delete_admin" ON "user" AS PERMISSIVE FOR DELETE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "verification_service_only" ON "verification" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "cpw_select_public" ON "cook_pickup_windows" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
        SELECT 1 FROM cook_profiles cp
        INNER JOIN "user" u ON u.id = cp.user_id
        WHERE cp.id = cook_pickup_windows.cook_id AND u.status = 'active'
      ));--> statement-breakpoint
CREATE POLICY "cpw_insert_own" ON "cook_pickup_windows" AS PERMISSIVE FOR INSERT TO public WITH CHECK (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "cpw_update_own" ON "cook_pickup_windows" AS PERMISSIVE FOR UPDATE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())) WITH CHECK (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "cpw_delete_own" ON "cook_pickup_windows" AS PERMISSIVE FOR DELETE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "cpw_all_admin" ON "cook_pickup_windows" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'admin');--> statement-breakpoint
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
CREATE POLICY "cook_profiles_select_active" ON "cook_profiles" AS PERMISSIVE FOR SELECT TO public USING (app_public_user_is_active(cook_profiles.user_id));--> statement-breakpoint
CREATE POLICY "cook_profiles_update_own" ON "cook_profiles" AS PERMISSIVE FOR UPDATE TO public USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "cook_profiles_insert_service" ON "cook_profiles" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "cook_profiles_update_admin" ON "cook_profiles" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
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
CREATE POLICY "legal_acceptances_insert_service" ON "legal_acceptances" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "legal_acceptances_select_own" ON "legal_acceptances" AS PERMISSIVE FOR SELECT TO public USING (user_id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "legal_acceptances_select_admin" ON "legal_acceptances" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "legal_acceptances_select_service" ON "legal_acceptances" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "listing_bundles_select_public" ON "listing_bundles" AS PERMISSIVE FOR SELECT TO public USING (
        is_active = TRUE
        AND listing_id IN (SELECT id FROM listings WHERE status = 'active')
      );--> statement-breakpoint
CREATE POLICY "listing_bundles_select_own" ON "listing_bundles" AS PERMISSIVE FOR SELECT TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
CREATE POLICY "listing_bundles_select_admin" ON "listing_bundles" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "listing_bundles_insert_own" ON "listing_bundles" AS PERMISSIVE FOR INSERT TO public WITH CHECK (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
CREATE POLICY "listing_bundles_update_own" ON "listing_bundles" AS PERMISSIVE FOR UPDATE TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
CREATE POLICY "listing_bundles_delete_own" ON "listing_bundles" AS PERMISSIVE FOR DELETE TO public USING (listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
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
CREATE POLICY "listings_select_active" ON "listings" AS PERMISSIVE FOR SELECT TO public USING (status = 'active');--> statement-breakpoint
CREATE POLICY "listings_select_own" ON "listings" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "listings_select_admin" ON "listings" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "listings_insert_own" ON "listings" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())
        AND status = 'draft'
        AND reviewed_at IS NULL
        AND reviewed_by IS NULL
        AND review_notes IS NULL
      );--> statement-breakpoint
CREATE POLICY "listings_update_own" ON "listings" AS PERMISSIVE FOR UPDATE TO public USING (cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()
)) WITH CHECK (cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()
));--> statement-breakpoint
CREATE POLICY "listings_update_admin" ON "listings" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "listings_delete_own_draft" ON "listings" AS PERMISSIVE FOR DELETE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()) AND status = 'draft');--> statement-breakpoint
CREATE POLICY "conversations_select_cook" ON "conversations" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "conversations_select_client" ON "conversations" AS PERMISSIVE FOR SELECT TO public USING (client_id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "conversations_insert_service" ON "conversations" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "conversations_update_cook" ON "conversations" AS PERMISSIVE FOR UPDATE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "messages_select_cook" ON "messages" AS PERMISSIVE FOR SELECT TO public USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text)
      ));--> statement-breakpoint
CREATE POLICY "messages_select_client" ON "messages" AS PERMISSIVE FOR SELECT TO public USING (conversation_id IN (
        SELECT id FROM conversations WHERE client_id = auth.uid()::text
      ));--> statement-breakpoint
CREATE POLICY "messages_insert_cook" ON "messages" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        sender_role = 'cook'
        AND conversation_id IN (
          SELECT id FROM conversations
          WHERE cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text)
        )
      );--> statement-breakpoint
CREATE POLICY "messages_insert_client" ON "messages" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        sender_role = 'client'
        AND conversation_id IN (
          SELECT id FROM conversations WHERE client_id = auth.uid()::text
        )
      );--> statement-breakpoint
CREATE POLICY "messages_update_cook" ON "messages" AS PERMISSIVE FOR UPDATE TO public USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text)
      ));--> statement-breakpoint
CREATE POLICY "messages_update_client" ON "messages" AS PERMISSIVE FOR UPDATE TO public USING (conversation_id IN (
        SELECT id FROM conversations WHERE client_id = auth.uid()::text
      ));--> statement-breakpoint
CREATE POLICY "notif_reads_select_own" ON "cook_notification_reads" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "notif_reads_insert_own" ON "cook_notification_reads" AS PERMISSIVE FOR INSERT TO public WITH CHECK (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "notif_reads_delete_own" ON "cook_notification_reads" AS PERMISSIVE FOR DELETE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "notif_reads_all_admin" ON "cook_notification_reads" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "order_dishes_select_client" ON "order_dishes" AS PERMISSIVE FOR SELECT TO public USING (order_id IN (SELECT id FROM orders WHERE client_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "order_dishes_select_cook" ON "order_dishes" AS PERMISSIVE FOR SELECT TO public USING (order_id IN (
        SELECT o.id FROM orders o
        JOIN cook_profiles cp ON o.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      ));--> statement-breakpoint
CREATE POLICY "order_dishes_select_admin" ON "order_dishes" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "order_dishes_insert_service" ON "order_dishes" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
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
CREATE POLICY "cook_agreements_select_admin" ON "cook_agreements" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "cook_agreements_select_own_cook" ON "cook_agreements" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "cook_agreements_insert_admin" ON "cook_agreements" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "cook_agreements_update_admin" ON "cook_agreements" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "cook_payouts_select_own_cook" ON "cook_payouts" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "cook_payouts_select_admin" ON "cook_payouts" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "cook_payouts_insert_service" ON "cook_payouts" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "cook_payouts_update_service" ON "cook_payouts" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "order_payments_select_client" ON "order_payments" AS PERMISSIVE FOR SELECT TO public USING (client_id = auth.uid());--> statement-breakpoint
CREATE POLICY "order_payments_select_cook" ON "order_payments" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "order_payments_select_admin" ON "order_payments" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "order_payments_insert_service" ON "order_payments" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "order_payments_update_service" ON "order_payments" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "stripe_webhook_events_select_admin" ON "stripe_webhook_events" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "stripe_webhook_events_insert_service" ON "stripe_webhook_events" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "stripe_webhook_events_delete_service" ON "stripe_webhook_events" AS PERMISSIVE FOR DELETE TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "user_prefs_own" ON "user_preferences" AS PERMISSIVE FOR ALL TO public USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "user_prefs_admin" ON "user_preferences" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "followed_cooks_select_own" ON "followed_cooks" AS PERMISSIVE FOR SELECT TO public USING (user_id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "followed_cooks_insert_own" ON "followed_cooks" AS PERMISSIVE FOR INSERT TO public WITH CHECK (user_id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "followed_cooks_delete_own" ON "followed_cooks" AS PERMISSIVE FOR DELETE TO public USING (user_id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "saved_listings_select_own" ON "saved_listings" AS PERMISSIVE FOR SELECT TO public USING (user_id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "saved_listings_insert_own" ON "saved_listings" AS PERMISSIVE FOR INSERT TO public WITH CHECK (user_id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "saved_listings_delete_own" ON "saved_listings" AS PERMISSIVE FOR DELETE TO public USING (user_id = auth.uid()::text);--> statement-breakpoint
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
CREATE POLICY "tiers_delete_service" ON "listing_subscription_tiers" AS PERMISSIVE FOR DELETE TO public USING (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "cook_profile_tags_select_public" ON "cook_profile_tags" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "cook_profile_tags_insert_own" ON "cook_profile_tags" AS PERMISSIVE FOR INSERT TO public WITH CHECK (cook_profile_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "cook_profile_tags_delete_own" ON "cook_profile_tags" AS PERMISSIVE FOR DELETE TO public USING (cook_profile_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "tags_select_all" ON "tags" AS PERMISSIVE FOR SELECT TO public USING (TRUE);--> statement-breakpoint
CREATE POLICY "tags_insert_admin" ON "tags" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "tags_update_admin" ON "tags" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "tags_delete_admin" ON "tags" AS PERMISSIVE FOR DELETE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "user_addresses_own" ON "user_addresses" AS PERMISSIVE FOR ALL TO public USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "user_addresses_admin" ON "user_addresses" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "rate_limit_log_service_only" ON "rate_limit_log" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "waitlist_service_only" ON "waitlist" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');