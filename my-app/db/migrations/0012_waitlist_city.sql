-- Optional city on waitlist signups.
-- Captured from the visitor's service address when they join the waitlist from
-- the out-of-area browse/search state. Null for marketing-site signups.

ALTER TABLE "waitlist" ADD COLUMN IF NOT EXISTS "city" text;
