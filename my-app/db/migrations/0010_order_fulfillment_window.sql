ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillment_window_start" timestamp;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillment_window_end" timestamp;
