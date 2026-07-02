ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax_amount" numeric(10, 2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax_province" varchar(2);
