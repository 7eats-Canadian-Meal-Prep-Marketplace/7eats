import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { accountStatus, userRole } from "./enums";

const isAdmin = sql`auth.role() = 'admin'`;
const isServiceRole = sql`auth.role() = 'service_role'`;

// enableRLS() uses Object.assign(this, ...) internally, so it mutates the table
// object in place. We call it for the side effect and export the original reference,
// which keeps the full PgTableWithColumns type (not the Omit the chained form returns).
const authUserTable = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    // App-specific fields
    role: userRole("role").notNull().default("cook"),
    status: accountStatus("status").notNull().default("active"),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    stripeCustomerId: text("stripe_customer_id"),
    onboardingCompletedAt: timestamp("onboarding_completed_at"),
    isGuestAccount: boolean("is_guest_account").notNull().default(false),
    // Must be >= 16 years old. Set at onboarding, not editable after.
    dateOfBirth: date("date_of_birth"),
    neighborhood: varchar("neighborhood", { length: 100 }),
    notificationPreferences: jsonb("notification_preferences").$type<{
      notifs: {
        new_listing: boolean;
        order_updates: boolean;
        messages: boolean;
        marketing: boolean;
      };
      channels: { sms: boolean; email: boolean };
    }>(),
  },
  (table) => [
    // A phone number may be verified on at most one account *per role*: one cook
    // and one client can share a number, but not two cooks or two clients.
    // Partial index so unverified/guest rows (phone_verified=false) never block.
    uniqueIndex("user_phone_role_verified_unique")
      .on(table.phone, table.role)
      .where(sql`${table.phoneVerified} = true AND ${table.phone} IS NOT NULL`),
    pgPolicy("user_select_own", {
      for: "select",
      to: "public",
      using: sql`id = auth.uid()`,
    }),
    pgPolicy("user_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("user_select_service", {
      for: "select",
      to: "public",
      using: isServiceRole,
    }),
    pgPolicy("user_insert_service", {
      for: "insert",
      to: "public",
      withCheck: isServiceRole,
    }),
    pgPolicy("user_update_own", {
      for: "update",
      to: "public",
      using: sql`id = auth.uid()::text`,
      withCheck: sql`id = auth.uid()::text`,
    }),
    pgPolicy("user_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("user_delete_admin", {
      for: "delete",
      to: "public",
      using: isAdmin,
    }),
  ],
);

authUserTable.enableRLS();
export { authUserTable };
export const authUser = authUserTable;

export const authSession = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
  },
  () => [
    pgPolicy("session_service_only", {
      for: "all",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
  ],
).enableRLS();

export const authAccount = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  () => [
    pgPolicy("account_service_only", {
      for: "all",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
  ],
).enableRLS();

export const authVerification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  () => [
    pgPolicy("verification_service_only", {
      for: "all",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
  ],
).enableRLS();
