-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."payment_status" AS ENUM(
    'pending', 'authorized', 'held', 'released', 'refunded', 'disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."payout_status" AS ENUM(
    'pending', 'in_transit', 'paid', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."late_cancel_fee_type" AS ENUM('flat', 'percentage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- ─── cook_profiles — new columns ──────────────────────────────────────────────

ALTER TABLE "cook_profiles"
  ADD COLUMN IF NOT EXISTS "platform_fee_pct" numeric(5, 2) NOT NULL DEFAULT 7.5,
  ADD COLUMN IF NOT EXISTS "late_cancel_fee_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "late_cancel_fee_type" "late_cancel_fee_type",
  ADD COLUMN IF NOT EXISTS "late_cancel_fee_value" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "late_cancel_window_hours" integer NOT NULL DEFAULT 24;
--> statement-breakpoint

ALTER TABLE "cook_profiles"
  DROP CONSTRAINT IF EXISTS "cook_profiles_fee_pct_valid",
  ADD CONSTRAINT "cook_profiles_fee_pct_valid"
    CHECK ("platform_fee_pct" > 0 AND "platform_fee_pct" <= 100);
--> statement-breakpoint

ALTER TABLE "cook_profiles"
  DROP CONSTRAINT IF EXISTS "cook_profiles_late_cancel_fee_positive",
  ADD CONSTRAINT "cook_profiles_late_cancel_fee_positive"
    CHECK ("late_cancel_fee_value" IS NULL OR "late_cancel_fee_value" > 0);
--> statement-breakpoint

ALTER TABLE "cook_profiles"
  DROP CONSTRAINT IF EXISTS "cook_profiles_late_cancel_window_positive",
  ADD CONSTRAINT "cook_profiles_late_cancel_window_positive"
    CHECK ("late_cancel_window_hours" >= 1);
--> statement-breakpoint

-- ─── orders — new columns ─────────────────────────────────────────────────────

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "pickup_code_hash" text,
  ADD COLUMN IF NOT EXISTS "pickup_code_expires_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "pickup_code_verified_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "pickup_code_attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "late_cancel_fee_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "late_cancel_fee_type" "late_cancel_fee_type",
  ADD COLUMN IF NOT EXISTS "late_cancel_fee_value" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "late_cancel_window_hours" integer,
  ADD COLUMN IF NOT EXISTS "late_cancel_fee_applied" numeric(10, 2);
--> statement-breakpoint

ALTER TABLE "orders"
  DROP CONSTRAINT IF EXISTS "orders_pickup_code_attempts_non_negative",
  ADD CONSTRAINT "orders_pickup_code_attempts_non_negative"
    CHECK ("pickup_code_attempts" >= 0);
--> statement-breakpoint

ALTER TABLE "orders"
  DROP CONSTRAINT IF EXISTS "orders_late_cancel_fee_applied_non_negative",
  ADD CONSTRAINT "orders_late_cancel_fee_applied_non_negative"
    CHECK ("late_cancel_fee_applied" IS NULL OR "late_cancel_fee_applied" >= 0);
--> statement-breakpoint

-- ─── cook_agreements ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cook_agreements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cook_id" uuid NOT NULL,
  "platform_fee_pct" numeric(5, 2) NOT NULL,
  "effective_from" timestamptz NOT NULL DEFAULT now(),
  "effective_until" timestamptz,
  "notes" text,
  "created_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cook_agreements_fee_pct_valid"
    CHECK ("platform_fee_pct" > 0 AND "platform_fee_pct" <= 100)
);
--> statement-breakpoint

ALTER TABLE "cook_agreements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "cook_agreements"
  DROP CONSTRAINT IF EXISTS "cook_agreements_cook_id_cook_profiles_id_fk";
ALTER TABLE "cook_agreements"
  ADD CONSTRAINT "cook_agreements_cook_id_cook_profiles_id_fk"
    FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "cook_agreements"
  DROP CONSTRAINT IF EXISTS "cook_agreements_created_by_user_id_fk";
ALTER TABLE "cook_agreements"
  ADD CONSTRAINT "cook_agreements_created_by_user_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE POLICY "cook_agreements_select_admin" ON "cook_agreements"
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.role() = 'admin');
--> statement-breakpoint

CREATE POLICY "cook_agreements_select_own_cook" ON "cook_agreements"
  AS PERMISSIVE FOR SELECT TO public
  USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));
--> statement-breakpoint

CREATE POLICY "cook_agreements_insert_admin" ON "cook_agreements"
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.role() = 'admin');
--> statement-breakpoint

CREATE POLICY "cook_agreements_update_admin" ON "cook_agreements"
  AS PERMISSIVE FOR UPDATE TO public
  USING (auth.role() = 'admin');
--> statement-breakpoint

-- ─── order_payments ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "order_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "cook_id" uuid NOT NULL,
  "client_id" text NOT NULL,
  "status" "payment_status" NOT NULL DEFAULT 'pending',
  "total_amount" numeric(10, 2) NOT NULL,
  "platform_fee_pct" numeric(5, 2) NOT NULL,
  "platform_fee_amount" numeric(10, 2),
  "cook_payout_amount" numeric(10, 2),
  "currency" varchar(3) DEFAULT 'CAD',
  "stripe_payment_intent_id" text,
  "stripe_charge_id" text,
  "stripe_transfer_id" text,
  "stripe_refund_id" text,
  "authorized_at" timestamptz,
  "held_at" timestamptz,
  "released_at" timestamptz,
  "refunded_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "order_payments_order_id_unique" UNIQUE ("order_id"),
  CONSTRAINT "order_payments_total_amount_positive" CHECK ("total_amount" > 0),
  CONSTRAINT "order_payments_fee_pct_valid"
    CHECK ("platform_fee_pct" > 0 AND "platform_fee_pct" <= 100)
);
--> statement-breakpoint

ALTER TABLE "order_payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "order_payments"
  DROP CONSTRAINT IF EXISTS "order_payments_order_id_orders_id_fk";
ALTER TABLE "order_payments"
  ADD CONSTRAINT "order_payments_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "order_payments"
  DROP CONSTRAINT IF EXISTS "order_payments_cook_id_cook_profiles_id_fk";
ALTER TABLE "order_payments"
  ADD CONSTRAINT "order_payments_cook_id_cook_profiles_id_fk"
    FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "order_payments"
  DROP CONSTRAINT IF EXISTS "order_payments_client_id_user_id_fk";
ALTER TABLE "order_payments"
  ADD CONSTRAINT "order_payments_client_id_user_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

CREATE POLICY "order_payments_select_client" ON "order_payments"
  AS PERMISSIVE FOR SELECT TO public
  USING (client_id = auth.uid());
--> statement-breakpoint

CREATE POLICY "order_payments_select_cook" ON "order_payments"
  AS PERMISSIVE FOR SELECT TO public
  USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));
--> statement-breakpoint

CREATE POLICY "order_payments_select_admin" ON "order_payments"
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.role() = 'admin');
--> statement-breakpoint

CREATE POLICY "order_payments_insert_service" ON "order_payments"
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');
--> statement-breakpoint

CREATE POLICY "order_payments_update_service" ON "order_payments"
  AS PERMISSIVE FOR UPDATE TO public
  USING (auth.role() = 'service_role');
--> statement-breakpoint

-- ─── cook_payouts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cook_payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cook_id" uuid NOT NULL,
  "stripe_payout_id" text NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "currency" varchar(3) DEFAULT 'CAD',
  "status" "payout_status" NOT NULL,
  "arrival_date" timestamptz,
  "period_start" timestamptz,
  "period_end" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cook_payouts_stripe_payout_id_unique" UNIQUE ("stripe_payout_id"),
  CONSTRAINT "cook_payouts_amount_positive" CHECK ("amount" > 0)
);
--> statement-breakpoint

ALTER TABLE "cook_payouts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "cook_payouts"
  DROP CONSTRAINT IF EXISTS "cook_payouts_cook_id_cook_profiles_id_fk";
ALTER TABLE "cook_payouts"
  ADD CONSTRAINT "cook_payouts_cook_id_cook_profiles_id_fk"
    FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

CREATE POLICY "cook_payouts_select_own_cook" ON "cook_payouts"
  AS PERMISSIVE FOR SELECT TO public
  USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));
--> statement-breakpoint

CREATE POLICY "cook_payouts_select_admin" ON "cook_payouts"
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.role() = 'admin');
--> statement-breakpoint

CREATE POLICY "cook_payouts_insert_service" ON "cook_payouts"
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');
--> statement-breakpoint

CREATE POLICY "cook_payouts_update_service" ON "cook_payouts"
  AS PERMISSIVE FOR UPDATE TO public
  USING (auth.role() = 'service_role');
