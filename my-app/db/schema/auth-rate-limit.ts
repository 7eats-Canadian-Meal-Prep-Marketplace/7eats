import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const isServiceRole = sql`auth.role() = 'service_role'`;

// Backs Better Auth's `secondaryStorage` (see lib/auth-secondary-storage.ts).
// Better Auth uses this as a durable key/value store for its rate limiter so
// counters are shared across serverless function instances instead of each
// instance keeping its own in-memory Map. `expiresAt` is nullable because not
// every secondaryStorage `set` call passes a ttl; rows with a null expiry
// simply never expire.
export const authKvStore = pgTable(
  "auth_kv_store",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  () => [
    pgPolicy("auth_kv_store_service_only", {
      for: "all",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
  ],
).enableRLS();
