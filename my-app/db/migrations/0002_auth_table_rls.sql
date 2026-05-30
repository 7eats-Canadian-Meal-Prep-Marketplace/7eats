CREATE TYPE "public"."late_cancel_fee_type" AS ENUM('flat', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'authorized', 'held', 'released', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'in_transit', 'paid', 'failed', 'cancelled');--> statement-breakpoint
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
	CONSTRAINT "order_payments_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "order_payments_total_amount_positive" CHECK ("order_payments"."total_amount" > 0),
	CONSTRAINT "order_payments_fee_pct_valid" CHECK ("order_payments"."platform_fee_pct" > 0 AND "order_payments"."platform_fee_pct" <= 100)
);
--> statement-breakpoint
ALTER TABLE "order_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD COLUMN "platform_fee_pct" numeric(5, 2) DEFAULT '7.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD COLUMN "late_cancel_fee_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD COLUMN "late_cancel_fee_type" "late_cancel_fee_type";--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD COLUMN "late_cancel_fee_value" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD COLUMN "late_cancel_window_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pickup_code_hash" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pickup_code_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pickup_code_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pickup_code_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "late_cancel_fee_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "late_cancel_fee_type" "late_cancel_fee_type";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "late_cancel_fee_value" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "late_cancel_window_hours" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "late_cancel_fee_applied" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "cook_agreements" ADD CONSTRAINT "cook_agreements_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_agreements" ADD CONSTRAINT "cook_agreements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_payouts" ADD CONSTRAINT "cook_payouts_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_fee_pct_valid" CHECK ("cook_profiles"."platform_fee_pct" > 0 AND "cook_profiles"."platform_fee_pct" <= 100);--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_late_cancel_fee_positive" CHECK ("cook_profiles"."late_cancel_fee_value" IS NULL OR "cook_profiles"."late_cancel_fee_value" > 0);--> statement-breakpoint
ALTER TABLE "cook_profiles" ADD CONSTRAINT "cook_profiles_late_cancel_window_positive" CHECK ("cook_profiles"."late_cancel_window_hours" >= 1);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickup_code_attempts_non_negative" CHECK ("orders"."pickup_code_attempts" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_late_cancel_fee_applied_non_negative" CHECK ("orders"."late_cancel_fee_applied" IS NULL OR "orders"."late_cancel_fee_applied" >= 0);--> statement-breakpoint
CREATE POLICY "account_service_only" ON "account" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "session_service_only" ON "session" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "user_select_all" ON "user" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "user_insert_service" ON "user" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "user_update_own" ON "user" AS PERMISSIVE FOR UPDATE TO public USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "user_update_admin" ON "user" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "user_delete_admin" ON "user" AS PERMISSIVE FOR DELETE TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "verification_service_only" ON "verification" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
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
CREATE POLICY "order_payments_update_service" ON "order_payments" AS PERMISSIVE FOR UPDATE TO public USING (auth.role() = 'service_role');