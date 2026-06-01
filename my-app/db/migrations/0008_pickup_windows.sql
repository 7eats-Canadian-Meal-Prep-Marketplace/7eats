-- Create normalized pickup windows table
CREATE TABLE "cook_pickup_windows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cook_id" uuid NOT NULL REFERENCES "cook_profiles"("id") ON DELETE CASCADE,
  "day_of_week" text NOT NULL,
  "from_time" time(0) NOT NULL,
  "to_time" time(0) NOT NULL,
  CONSTRAINT "cpw_cook_day_uidx" UNIQUE ("cook_id", "day_of_week"),
  CONSTRAINT "cpw_time_order" CHECK (to_time > from_time),
  CONSTRAINT "cpw_day_valid" CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday'))
);

ALTER TABLE "cook_pickup_windows" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpw_select_public" ON "cook_pickup_windows"
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM cook_profiles cp
    INNER JOIN "user" u ON u.id = cp.user_id
    WHERE cp.id = cook_pickup_windows.cook_id AND u.status = 'active'
  ));

CREATE POLICY "cpw_insert_own" ON "cook_pickup_windows"
  FOR INSERT TO public
  WITH CHECK (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));

CREATE POLICY "cpw_update_own" ON "cook_pickup_windows"
  FOR UPDATE TO public
  USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()))
  WITH CHECK (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));

CREATE POLICY "cpw_delete_own" ON "cook_pickup_windows"
  FOR DELETE TO public
  USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));

CREATE POLICY "cpw_all_admin" ON "cook_pickup_windows"
  FOR ALL TO public
  USING (auth.role() = 'admin');

-- Migrate existing data (pickup_days × global from/to → one row per day)
INSERT INTO "cook_pickup_windows" ("cook_id", "day_of_week", "from_time", "to_time")
SELECT
  id,
  day_name,
  pickup_from::time(0),
  pickup_to::time(0)
FROM "cook_profiles"
CROSS JOIN unnest(pickup_days) AS day_name
WHERE pickup_days IS NOT NULL
  AND pickup_from IS NOT NULL
  AND pickup_to IS NOT NULL
  AND day_name IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday');

-- Drop the old columns (handle both pre- and post-JSONB-migration states)
ALTER TABLE "cook_profiles" DROP COLUMN IF EXISTS "pickup_windows";
ALTER TABLE "cook_profiles" DROP COLUMN IF EXISTS "pickup_days";
ALTER TABLE "cook_profiles" DROP COLUMN IF EXISTS "pickup_from";
ALTER TABLE "cook_profiles" DROP COLUMN IF EXISTS "pickup_to";
