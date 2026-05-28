import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { cookProfiles } from "./cooks";
import { listingStatus } from "./enums";
import { tags } from "./tags";

const isAdmin = sql`auth.role() = 'admin'`;

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: listingStatus("status").notNull().default("draft"),
    basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("CAD"),
    portionSize: varchar("portion_size", { length: 100 }),
    minOrderQty: integer("min_order_qty").notNull().default(1),
    maxOrderQty: integer("max_order_qty"),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: text("reviewed_by").references(() => authUser.id, {
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
    pgPolicy("listings_select_active", {
      for: "select",
      to: "public",
      using: sql`status = 'active'`,
    }),
    pgPolicy("listings_select_own", {
      for: "select",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("listings_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("listings_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`
        cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())
        AND status = 'draft'
        AND reviewed_at IS NULL
        AND reviewed_by IS NULL
        AND review_notes IS NULL
      `,
    }),
    pgPolicy("listings_update_own", {
      for: "update",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
      withCheck: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("listings_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("listings_delete_own_draft", {
      for: "delete",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()) AND status = 'draft'`,
    }),
  ],
).enableRLS();

export const listingPhotos = pgTable(
  "listing_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("photos_select_active_listing", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (SELECT id FROM listings WHERE status = 'active')`,
    }),
    pgPolicy("photos_select_own", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
    pgPolicy("photos_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
    pgPolicy("photos_update_own", {
      for: "update",
      to: "public",
      using: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
    pgPolicy("photos_delete_own", {
      for: "delete",
      to: "public",
      using: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
  ],
).enableRLS();

export const listingIngredients = pgTable(
  "listing_ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: varchar("quantity", { length: 100 }),
    isAllergen: boolean("is_allergen").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  () => [
    pgPolicy("ingredients_select_active_listing", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (SELECT id FROM listings WHERE status = 'active')`,
    }),
    pgPolicy("ingredients_select_own", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
    pgPolicy("ingredients_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
    pgPolicy("ingredients_update_own", {
      for: "update",
      to: "public",
      using: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
    pgPolicy("ingredients_delete_own", {
      for: "delete",
      to: "public",
      using: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
  ],
).enableRLS();

export const listingNutrition = pgTable(
  "listing_nutrition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .unique()
      .references(() => listings.id, { onDelete: "cascade" }),
    calories: integer("calories"),
    proteinG: numeric("protein_g", { precision: 6, scale: 2 }),
    carbsG: numeric("carbs_g", { precision: 6, scale: 2 }),
    fatG: numeric("fat_g", { precision: 6, scale: 2 }),
    fiberG: numeric("fiber_g", { precision: 6, scale: 2 }),
    sodiumMg: numeric("sodium_mg", { precision: 8, scale: 2 }),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [
    pgPolicy("nutrition_select_active_listing", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (SELECT id FROM listings WHERE status = 'active')`,
    }),
    pgPolicy("nutrition_select_own", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
    pgPolicy("nutrition_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
    pgPolicy("nutrition_update_own", {
      for: "update",
      to: "public",
      using: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
  ],
).enableRLS();

export const listingTags = pgTable(
  "listing_tags",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.tagId] }),
    pgPolicy("listing_tags_select_all", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (SELECT id FROM listings WHERE status = 'active')`,
    }),
    pgPolicy("listing_tags_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
    pgPolicy("listing_tags_delete_own", {
      for: "delete",
      to: "public",
      using: sql`listing_id IN (SELECT l.id FROM listings l JOIN cook_profiles cp ON l.cook_id = cp.id WHERE cp.user_id = auth.uid())`,
    }),
  ],
).enableRLS();
