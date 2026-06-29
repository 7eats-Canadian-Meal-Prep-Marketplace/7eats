ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reviewer_display_name" varchar(120);

UPDATE "reviews" AS r
SET "reviewer_display_name" = trim(
  both
  from
    concat_ws(
      ' ',
      u.first_name,
      CASE
        WHEN u.last_name IS NOT NULL AND u.last_name <> '' THEN left(u.last_name, 1) || '.'
        ELSE NULL
      END
    )
)
FROM "user" AS u
WHERE u.id = r.client_id
  AND r.reviewer_display_name IS NULL
  AND u.status <> 'deleted';
