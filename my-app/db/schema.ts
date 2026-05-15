import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  ipHash: text("ip_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rateLimitLog = pgTable("rate_limit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  ipHash: text("ip_hash").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
});
