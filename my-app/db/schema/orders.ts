import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { cookProfiles } from "./cooks";
import { orderStatus } from "./enums";
import { listings } from "./listings";
import { users } from "./users";

const isAdmin = sql`auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`;
const currentCookOwnsOrder = sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`;

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("pending"),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("CAD"),
    pickupAt: timestamp("pickup_at").notNull(),
    fulfilledAt: timestamp("fulfilled_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancelledBy: uuid("cancelled_by").references(() => users.id, {
      onDelete: "set null",
    }),
    lateCancelFee: numeric("late_cancel_fee", { precision: 10, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [
    pgPolicy("orders_select_client", {
      for: "select",
      using: sql`client_id = auth.uid()`,
    }),
    pgPolicy("orders_select_cook", {
      for: "select",
      using: currentCookOwnsOrder,
    }),
    pgPolicy("orders_select_admin", {
      for: "select",
      using: isAdmin,
    }),
    pgPolicy("orders_insert_client", {
      for: "insert",
      withCheck: sql`client_id = auth.uid()`,
    }),
    pgPolicy("orders_update_client", {
      for: "update",
      using: sql`client_id = auth.uid() AND status = 'pending'`,
      withCheck: sql`client_id = auth.uid() AND status IN ('pending', 'cancelled')`,
    }),
    pgPolicy("orders_update_cook", {
      for: "update",
      using: sql`${currentCookOwnsOrder} AND status IN ('pending', 'confirmed', 'ready')`,
      withCheck: sql`${currentCookOwnsOrder} AND status IN ('confirmed', 'ready', 'fulfilled', 'cancelled')`,
    }),
    pgPolicy("orders_update_admin", {
      for: "update",
      using: isAdmin,
    }),
  ],
).enableRLS();

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "restrict" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    isVisible: boolean("is_visible").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("reviews_rating_range", sql`${table.rating} BETWEEN 1 AND 5`),
    pgPolicy("reviews_select_visible", {
      for: "select",
      using: sql`is_visible = TRUE`,
    }),
    pgPolicy("reviews_select_own", {
      for: "select",
      using: sql`client_id = auth.uid() OR cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("reviews_select_admin", {
      for: "select",
      using: isAdmin,
    }),
    pgPolicy("reviews_insert_client", {
      for: "insert",
      withCheck: sql`client_id = auth.uid() AND order_id IN (SELECT id FROM orders WHERE client_id = auth.uid() AND status = 'fulfilled')`,
    }),
    pgPolicy("reviews_update_own", {
      for: "update",
      using: sql`client_id = auth.uid()`,
      withCheck: sql`client_id = auth.uid()`,
    }),
    pgPolicy("reviews_update_admin", {
      for: "update",
      using: isAdmin,
    }),
  ],
).enableRLS();
