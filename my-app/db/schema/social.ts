import { sql } from "drizzle-orm";
import {
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { cookProfiles } from "./cooks";
import { listings } from "./listings";

// ─── Saved Listings ───────────────────────────────────────────────────────────

export const savedListings = pgTable(
  "saved_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_listings_user_listing_uidx").on(t.userId, t.listingId),
    pgPolicy("saved_listings_select_own", {
      for: "select",
      to: "public",
      using: sql`user_id = auth.uid()::text`,
    }),
    pgPolicy("saved_listings_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`user_id = auth.uid()::text`,
    }),
    pgPolicy("saved_listings_delete_own", {
      for: "delete",
      to: "public",
      using: sql`user_id = auth.uid()::text`,
    }),
  ],
).enableRLS();

// ─── Followed Cooks ───────────────────────────────────────────────────────────

export const followedCooks = pgTable(
  "followed_cooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("followed_cooks_user_cook_uidx").on(t.userId, t.cookId),
    pgPolicy("followed_cooks_select_own", {
      for: "select",
      to: "public",
      using: sql`user_id = auth.uid()::text`,
    }),
    pgPolicy("followed_cooks_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`user_id = auth.uid()::text`,
    }),
    pgPolicy("followed_cooks_delete_own", {
      for: "delete",
      to: "public",
      using: sql`user_id = auth.uid()::text`,
    }),
  ],
).enableRLS();
