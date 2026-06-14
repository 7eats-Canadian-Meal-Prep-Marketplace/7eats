DELETE FROM "listing_promotions" WHERE "type" = 'buy_x_get_y';
--> statement-breakpoint
ALTER TABLE "listing_promotions" DROP CONSTRAINT "promo_bxgy_fields";
--> statement-breakpoint
ALTER TABLE "listing_promotions" DROP CONSTRAINT "promo_percentage_max";
--> statement-breakpoint
ALTER TABLE "listing_promotions" DROP CONSTRAINT "promo_fixed_requires_value";
--> statement-breakpoint
ALTER TABLE "listing_promotions" DROP COLUMN "buy_qty";
--> statement-breakpoint
ALTER TABLE "listing_promotions" DROP COLUMN "get_qty";
--> statement-breakpoint
CREATE TYPE "public"."promotion_type_new" AS ENUM('percentage_off', 'fixed_off');
--> statement-breakpoint
ALTER TABLE "listing_promotions" ALTER COLUMN "type" TYPE "public"."promotion_type_new" USING "type"::text::"public"."promotion_type_new";
--> statement-breakpoint
DROP TYPE "public"."promotion_type";
--> statement-breakpoint
ALTER TYPE "public"."promotion_type_new" RENAME TO "promotion_type";
--> statement-breakpoint
ALTER TABLE "listing_promotions" ADD CONSTRAINT "promo_percentage_max" CHECK ("listing_promotions"."type" != 'percentage_off' OR ("listing_promotions"."value" IS NOT NULL AND "listing_promotions"."value" <= 100));
--> statement-breakpoint
ALTER TABLE "listing_promotions" ADD CONSTRAINT "promo_fixed_requires_value" CHECK ("listing_promotions"."type" != 'fixed_off' OR "listing_promotions"."value" IS NOT NULL);
