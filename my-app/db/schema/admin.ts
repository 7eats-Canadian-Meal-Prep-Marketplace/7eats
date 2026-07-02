import { sql } from "drizzle-orm";
import {
  boolean,
  pgPolicy,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Better Auth admin instance — a separate auth stack for internal admin users,
// parallel to the main user/session/account/verification tables in auth.ts.
// These tables were originally created via `drizzle-kit push` and live outside
// the migration history; they are modelled here so the schema matches the
// database and `push` stays clean. Service-role only at the RLS layer.
const isServiceRole = sql`auth.role() = 'service_role'`;

const servicePolicy = () => [
  pgPolicy("service_only", {
    for: "all",
    to: "public",
    using: isServiceRole,
    withCheck: isServiceRole,
  }),
];

// enableRLS() mutates the table in place; export the original reference so the
// full typed table (used by the FK references below) is preserved.
const adminUserTable = pgTable(
  "admin_user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique("admin_user_email_key"),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    role: text("role").notNull().default("admin"),
  },
  servicePolicy,
);

adminUserTable.enableRLS();
export { adminUserTable };
export const adminUser = adminUserTable;

export const adminAccount = pgTable(
  "admin_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUser.id, { onDelete: "cascade" }),
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
  servicePolicy,
).enableRLS();

export const adminSession = pgTable(
  "admin_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique("admin_session_token_key"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => adminUser.id, { onDelete: "cascade" }),
  },
  servicePolicy,
).enableRLS();

export const adminVerification = pgTable(
  "admin_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  servicePolicy,
).enableRLS();
