-- Per-role phone uniqueness.
-- A phone number may be verified on at most one account *per role*: the same
-- number can back one cook and one client account simultaneously (allowed), but
-- not two cooks or two clients. Partial index so unverified/guest rows
-- (phone_verified = false) never block a future verification.

CREATE UNIQUE INDEX IF NOT EXISTS "user_phone_role_verified_unique"
  ON "user" USING btree ("phone", "role")
  WHERE phone_verified = true AND phone IS NOT NULL;
