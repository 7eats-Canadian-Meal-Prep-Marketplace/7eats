-- Undo Former-customer anonymization from 0015; reviews keep the poster's name.
UPDATE "reviews"
SET "reviewer_display_name" = NULL
WHERE "reviewer_display_name" = 'Former customer';
