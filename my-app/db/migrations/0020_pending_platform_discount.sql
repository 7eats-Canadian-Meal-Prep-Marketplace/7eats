ALTER TABLE "order_payments" ADD COLUMN "pending_platform_discount_id" uuid;
ALTER TABLE "order_payments" ADD COLUMN "pending_platform_discount_amount" numeric(10, 2);

ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_pending_platform_discount_id_platform_discounts_id_fk" FOREIGN KEY ("pending_platform_discount_id") REFERENCES "public"."platform_discounts"("id") ON DELETE set null ON UPDATE no action;
