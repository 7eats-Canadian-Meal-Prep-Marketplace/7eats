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

const isAdmin = sql`auth.role() = 'admin'`;
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
      to: "public",
      using: sql`client_id = auth.uid()`,
    }),
    pgPolicy("orders_select_cook", {
      for: "select",
      to: "public",
      using: currentCookOwnsOrder,
    }),
    pgPolicy("orders_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("orders_insert_client", {
      for: "insert",
      to: "public",
      withCheck: sql`
        client_id = auth.uid()
        AND status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM listings l
          WHERE l.id = orders.listing_id
            AND l.status = 'active'
            AND l.cook_id = orders.cook_id
            AND l.base_price = orders.unit_price
        )
        AND orders.total_price = orders.unit_price * orders.quantity
      `,
    }),
    pgPolicy("orders_update_client", {
      for: "update",
      to: "public",
      using: sql`client_id = auth.uid() AND status = 'pending'`,
      withCheck: sql`client_id = auth.uid() AND status IN ('pending', 'cancelled')`,
    }),
    pgPolicy("orders_update_cook", {
      for: "update",
      to: "public",
      using: sql`${currentCookOwnsOrder} AND status IN ('pending', 'confirmed', 'ready')`,
      withCheck: sql`${currentCookOwnsOrder} AND status IN ('confirmed', 'ready', 'fulfilled', 'cancelled')`,
    }),
    pgPolicy("orders_update_admin", {
      for: "update",
      to: "public",
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
      to: "public",
      using: sql`is_visible = TRUE`,
    }),
    pgPolicy("reviews_select_own", {
      for: "select",
      to: "public",
      using: sql`client_id = auth.uid() OR cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("reviews_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("reviews_insert_client", {
      for: "insert",
      to: "public",
      withCheck: sql`
        client_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.id = reviews.order_id
            AND o.client_id = auth.uid()
            AND o.status = 'fulfilled'
            AND o.cook_id = reviews.cook_id
            AND o.listing_id = reviews.listing_id
        )
      `,
    }),
    pgPolicy("reviews_update_own", {
      for: "update",
      to: "public",
      using: sql`client_id = auth.uid()`,
      withCheck: sql`client_id = auth.uid()`,
    }),
    pgPolicy("reviews_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
  ],
).enableRLS();
