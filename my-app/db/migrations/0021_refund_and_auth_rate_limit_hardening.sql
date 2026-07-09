ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'partially_refunded';

ALTER TABLE "order_payments"
  ADD COLUMN IF NOT EXISTS "amount_refunded_cents" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "auth_kv_store" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone
);

ALTER TABLE "auth_kv_store" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'auth_kv_store'
      AND policyname = 'auth_kv_store_service_only'
  ) THEN
    CREATE POLICY "auth_kv_store_service_only"
      ON "auth_kv_store"
      AS PERMISSIVE
      FOR ALL
      TO public
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
