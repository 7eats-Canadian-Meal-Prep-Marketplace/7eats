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
import { certificationStatus } from "./enums";
import { users } from "./users";

export const cookProfiles = pgTable(
  "cook_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    bio: text("bio"),
    city: varchar("city", { length: 100 }),
    province: varchar("province", { length: 50 }),
    postalCode: varchar("postal_code", { length: 10 }),
    onboardingDone: boolean("onboarding_done").notNull().default(false),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("cook_profiles_select_active", {
      for: "select",
      using: sql`EXISTS (SELECT 1 FROM users u WHERE u.id = cook_profiles.user_id AND u.status = 'active')`,
    }),
    pgPolicy("cook_profiles_update_own", {
      for: "update",
      using: sql`user_id = auth.uid()`,
      withCheck: sql`user_id = auth.uid()`,
    }),
    pgPolicy("cook_profiles_insert_service", {
      for: "insert",
      withCheck: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("cook_profiles_update_admin", {
      for: "update",
      using: sql`EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')`,
    }),
  ],
).enableRLS();

export const cookCertifications = pgTable(
  "cook_certifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    issuer: varchar("issuer", { length: 255 }),
    certificateNumber: varchar("certificate_number", { length: 100 }),
    province: varchar("province", { length: 50 }),
    issuedAt: timestamp("issued_at"),
    expiresAt: timestamp("expires_at"),
    fileUrl: text("file_url").notNull(),
    status: certificationStatus("status").notNull().default("pending_review"),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("certs_select_own", {
      for: "select",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("certs_select_approved", {
      for: "select",
      using: sql`status = 'approved'`,
    }),
    pgPolicy("certs_select_admin", {
      for: "select",
      using: sql`EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')`,
    }),
    pgPolicy("certs_insert_own", {
      for: "insert",
      withCheck: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("certs_update_admin", {
      for: "update",
      using: sql`EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')`,
    }),
    pgPolicy("certs_delete_own_pending", {
      for: "delete",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()) AND status = 'pending_review'`,
    }),
  ],
).enableRLS();
