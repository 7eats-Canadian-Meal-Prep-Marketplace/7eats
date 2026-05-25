import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { cookApplications } from "./applications";
import { certificationStatus, deliveryEnum, leadTimeEnum } from "./enums";
import { users } from "./users";

const isAdmin = sql`auth.role() = 'admin'`;

export const cookProfiles = pgTable(
  "cook_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
      .notNull()
      .unique()
      .references(() => cookApplications.id),
    displayName: text("display_name").notNull(),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    socialLink: text("social_link"),
    currentSetupStep: integer("current_setup_step").notNull().default(1),
    setupComplete: boolean("setup_complete").notNull().default(false),
    pickupAddress: text("pickup_address"),
    pickupDays: text("pickup_days").array(),
    pickupFrom: text("pickup_from"),
    pickupTo: text("pickup_to"),
    leadTime: leadTimeEnum("lead_time"),
    maxCapacity: integer("max_capacity"),
    delivery: deliveryEnum("delivery"),
    acceptsSpecialRequests: boolean("accepts_special_requests")
      .notNull()
      .default(false),
    stripeAccountId: text("stripe_account_id"),
    tosAcceptedAt: timestamp("tos_accepted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [
    pgPolicy("cook_profiles_select_active", {
      for: "select",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM users u WHERE u.id = cook_profiles.user_id AND u.status = 'active')`,
    }),
    pgPolicy("cook_profiles_update_own", {
      for: "update",
      to: "public",
      using: sql`user_id = auth.uid()`,
      withCheck: sql`user_id = auth.uid()`,
    }),
    pgPolicy("cook_profiles_insert_service", {
      for: "insert",
      to: "public",
      withCheck: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("cook_profiles_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
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
    holderName: text("holder_name").notNull(),
    issuer: varchar("issuer", { length: 255 }),
    certificateNumber: varchar("certificate_number", { length: 100 }),
    province: varchar("province", { length: 50 }),
    issuedAt: timestamp("issued_at"),
    expiresAt: timestamp("expires_at"),
    fileUrl: text("file_url"),
    status: certificationStatus("status").notNull().default("pending_review"),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [
    pgPolicy("certs_select_own", {
      for: "select",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("certs_select_approved", {
      for: "select",
      to: "public",
      using: sql`status = 'approved'`,
    }),
    pgPolicy("certs_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("certs_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`
        cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())
        AND status = 'pending_review'
        AND reviewed_at IS NULL
        AND reviewed_by IS NULL
        AND review_notes IS NULL
      `,
    }),
    pgPolicy("certs_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("certs_delete_own_pending", {
      for: "delete",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()) AND status = 'pending_review'`,
    }),
  ],
).enableRLS();
