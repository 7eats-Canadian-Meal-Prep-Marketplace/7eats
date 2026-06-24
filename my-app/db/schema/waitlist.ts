import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const isServiceRole = sql`auth.role() = 'service_role'`;

export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    // Optional — captured from the visitor's service address when they join the
    // waitlist from the out-of-area browse/search state. Null for marketing-site
    // signups, which collect email only.
    city: text("city"),
    ipHash: text("ip_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    pgPolicy("waitlist_service_only", {
      for: "all",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
  ],
).enableRLS();

export const rateLimitLog = pgTable(
  "rate_limit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipHash: text("ip_hash").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    pgPolicy("rate_limit_log_service_only", {
      for: "all",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
  ],
).enableRLS();
