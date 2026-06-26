-- Cook new-order SMS is on by default; existing profiles were created with false
-- before the toggle shipped, so opt them in to match the new default.
ALTER TABLE "cook_profiles" ALTER COLUMN "sms_notifications_new_order" SET DEFAULT true;
UPDATE "cook_profiles" SET "sms_notifications_new_order" = true WHERE "sms_notifications_new_order" = false;
