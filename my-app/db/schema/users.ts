import { sql } from "drizzle-orm";
import {
  boolean,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { accountStatus, userRole } from "./enums";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: userRole("role").notNull().default("client"),
    status: accountStatus("status").notNull().default("active"),
    phone: varchar("phone", { length: 20 }).notNull().unique(),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).unique(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("users_select_own", {
      for: "select",
      using: sql`id = auth.uid()`,
    }),
    pgPolicy("users_select_admin", {
      for: "select",
      using: sql`EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')`,
    }),
    pgPolicy("users_update_own", {
      for: "update",
      using: sql`id = auth.uid()`,
      withCheck: sql`id = auth.uid()`,
    }),
    pgPolicy("users_insert_service", {
      for: "insert",
      withCheck: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("users_delete_admin", {
      for: "delete",
      using: sql`EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')`,
    }),
  ],
).enableRLS();

export const phoneOtps = pgTable(
  "phone_otps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    phone: varchar("phone", { length: 20 }).notNull(),
    code: varchar("code", { length: 6 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("otps_service_only", {
      for: "all",
      using: sql`auth.role() = 'service_role'`,
      withCheck: sql`auth.role() = 'service_role'`,
    }),
  ],
).enableRLS();
