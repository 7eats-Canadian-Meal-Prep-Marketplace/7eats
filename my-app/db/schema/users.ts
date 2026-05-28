import { sql } from "drizzle-orm";
import {
  boolean,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { accountStatus, userRole } from "./enums";

const isAdmin = sql`auth.role() = 'admin'`;

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    role: userRole("role").notNull().default("client"),
    status: accountStatus("status").notNull().default("active"),
    phone: varchar("phone", { length: 20 }),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).unique(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Unique phones among cooks only — the same number can appear on a client account
    uniqueIndex("users_cook_phone_unique")
      .on(table.phone)
      .where(sql`role = 'cook'`),
    pgPolicy("users_select_own", {
      for: "select",
      to: "public",
      using: sql`id = auth.uid()`,
    }),
    pgPolicy("users_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("users_update_own", {
      for: "update",
      to: "public",
      using: sql`id = auth.uid()`,
      withCheck: sql`id = auth.uid()`,
    }),
    pgPolicy("users_insert_service", {
      for: "insert",
      to: "public",
      withCheck: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("users_delete_admin", {
      for: "delete",
      to: "public",
      using: isAdmin,
    }),
  ],
).enableRLS();
