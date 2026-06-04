ALTER TABLE "user_preferences"
  ALTER COLUMN "why_meal_prep" SET DATA TYPE json
  USING (
    CASE
      WHEN "why_meal_prep" IS NULL OR btrim("why_meal_prep") = '' THEN '[]'::json
      WHEN "why_meal_prep" ~ '^\s*\[' THEN "why_meal_prep"::json
      ELSE to_json(string_to_array("why_meal_prep", ' · '))
    END
  );--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "why_meal_prep" SET NOT NULL;
