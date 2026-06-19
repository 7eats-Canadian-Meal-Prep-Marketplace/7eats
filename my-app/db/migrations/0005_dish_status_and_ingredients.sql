-- Migrate dish_status: draft/active/archived → active/inactive (idempotent).
-- Policies referencing dishes.status must be dropped before the column type change.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'dish_status'
      AND e.enumlabel = 'draft'
  ) THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "dish_promotions_select_public" ON "dish_promotions";
  DROP POLICY IF EXISTS "dish_ingredients_select_public" ON "dish_ingredients";
  DROP POLICY IF EXISTS "dish_nutrition_select_public" ON "dish_nutrition";
  DROP POLICY IF EXISTS "dish_photos_select_public" ON "dish_photos";
  DROP POLICY IF EXISTS "dish_tags_select_public" ON "dish_tags";
  DROP POLICY IF EXISTS "dishes_select_public" ON "dishes";

  ALTER TYPE "dish_status" RENAME TO "dish_status_old";

  CREATE TYPE "dish_status" AS ENUM('active', 'inactive');

  ALTER TABLE "dishes" ALTER COLUMN "status" DROP DEFAULT;

  ALTER TABLE "dishes" ALTER COLUMN "status" TYPE "dish_status" USING (
    CASE "status"::text
      WHEN 'active' THEN 'active'::"dish_status"
      WHEN 'draft' THEN 'active'::"dish_status"
      WHEN 'archived' THEN 'inactive'::"dish_status"
      ELSE 'active'::"dish_status"
    END
  );

  ALTER TABLE "dishes" ALTER COLUMN "status" SET DEFAULT 'active'::"dish_status";

  DROP TYPE "dish_status_old";

  CREATE POLICY "dishes_select_public" ON "dishes" AS PERMISSIVE FOR SELECT TO public USING (status = 'active');

  CREATE POLICY "dish_photos_select_public" ON "dish_photos" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
    SELECT id FROM dishes WHERE status = 'active'
  ));

  CREATE POLICY "dish_ingredients_select_public" ON "dish_ingredients" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
    SELECT id FROM dishes WHERE status = 'active'
  ));

  CREATE POLICY "dish_nutrition_select_public" ON "dish_nutrition" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
    SELECT id FROM dishes WHERE status = 'active'
  ));

  CREATE POLICY "dish_tags_select_public" ON "dish_tags" AS PERMISSIVE FOR SELECT TO public USING (dish_id IN (
    SELECT id FROM dishes WHERE status = 'active'
  ));

  CREATE POLICY "dish_promotions_select_public" ON "dish_promotions" AS PERMISSIVE FOR SELECT TO public USING (
    is_active = TRUE
    AND dish_id IN (SELECT id FROM dishes WHERE status = 'active')
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until > NOW())
    AND (max_uses IS NULL OR uses_count < max_uses)
  );
END $$;--> statement-breakpoint
ALTER TABLE "dish_ingredients" DROP COLUMN IF EXISTS "quantity";--> statement-breakpoint
DROP POLICY IF EXISTS "dishes_delete_own" ON "dishes";--> statement-breakpoint
CREATE POLICY "dishes_delete_own" ON "dishes" AS PERMISSIVE FOR DELETE TO public USING (cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text
));
