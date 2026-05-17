CREATE TABLE IF NOT EXISTS "waitlist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "ip_hash" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "rate_limit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ip_hash" text NOT NULL,
  "attempted_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "rate_limit_log_ip_hash_attempted_at_idx"
  ON "rate_limit_log" ("ip_hash", "attempted_at");
