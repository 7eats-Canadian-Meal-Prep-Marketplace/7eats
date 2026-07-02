ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmation_code" varchar(16);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guest_access_token_hash" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "is_guest_checkout" boolean DEFAULT false NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "orders_confirmation_code_idx" ON "orders" ("confirmation_code") WHERE "confirmation_code" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_guest_access_token_hash_idx" ON "orders" ("guest_access_token_hash") WHERE "guest_access_token_hash" IS NOT NULL;
