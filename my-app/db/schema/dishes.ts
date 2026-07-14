import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { cookProfiles } from "./cooks";
import { dishStatus, promotionType } from "./enums";
import { tags } from "./tags";

const isAdmin = sql`auth.role() = 'admin'`;

// cook owns this dish
const ownDish = sql`cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text
)`;

// dish is publicly visible when it is active AND its cook's kitchen is public
// (onboarding complete + active account) — hides dishes of cooks who saved
// their setup for later.
const dishIsActive = sql`status = 'active' AND app_cook_is_public(cook_id)`;

// helper for child tables: cook owns the parent dish
const ownDishChild = sql`dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
)`;

// helper for child tables: parent dish is active and its cook's kitchen is public
const dishChildOfActive = sql`dish_id IN (
  SELECT id FROM dishes WHERE status = 'active' AND app_cook_is_public(cook_id)
)`;

// ─── Dish ────────────────────────────────────────────────────────────────────

export const dishes = pgTable(
  "dishes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    // Culinary identity
    cuisine: varchar("cuisine", { length: 100 }),
    // Array of category slugs: weight_loss, muscle_gain, heart_health,
    // high_protein, low_carb, balanced, comfort_food, kids_friendly, etc.
    // Validated at application layer; stored as text[] for flexibility.
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    // Dietary flags — all default false; cooks opt-in
    isHalal: boolean("is_halal").notNull().default(false),
    isVegan: boolean("is_vegan").notNull().default(false),
    isVegetarian: boolean("is_vegetarian").notNull().default(false),
    isGlutenFree: boolean("is_gluten_free").notNull().default(false),
    isDairyFree: boolean("is_dairy_free").notNull().default(false),
    isNutFree: boolean("is_nut_free").notNull().default(false),
    isKosher: boolean("is_kosher").notNull().default(false),
    // Portion info
    servingSize: varchar("serving_size", { length: 100 }),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    // Workflow status — also drives public visibility (active = visible).
    status: dishStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("dishes_cook_id_idx").on(t.cookId),
    // Drafts may use 0 as a placeholder until the cook sets a real price.
    check(
      "dishes_price_positive",
      sql`(${t.status} = 'draft' AND ${t.price} >= 0) OR (${t.status} <> 'draft' AND ${t.price} > 0)`,
    ),
    // Public: dish is active
    pgPolicy("dishes_select_public", {
      for: "select",
      to: "public",
      using: dishIsActive,
    }),
    pgPolicy("dishes_select_own", {
      for: "select",
      to: "public",
      using: ownDish,
    }),
    pgPolicy("dishes_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("dishes_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`cook_id IN (
        SELECT id FROM cook_profiles WHERE user_id = auth.uid()
      )`,
    }),
    pgPolicy("dishes_update_own", {
      for: "update",
      to: "public",
      using: ownDish,
      withCheck: ownDish,
    }),
    pgPolicy("dishes_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("dishes_delete_own", {
      for: "delete",
      to: "public",
      using: ownDish,
    }),
    // Hard-delete blocked when order_dishes references the dish (ON DELETE restrict).
  ],
).enableRLS();

// ─── Dish Photos ─────────────────────────────────────────────────────────────

export const dishPhotos = pgTable(
  "dish_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("dish_photos_select_public", {
      for: "select",
      to: "public",
      using: dishChildOfActive,
    }),
    pgPolicy("dish_photos_select_own", {
      for: "select",
      to: "public",
      using: ownDishChild,
    }),
    pgPolicy("dish_photos_insert_own", {
      for: "insert",
      to: "public",
      withCheck: ownDishChild,
    }),
    pgPolicy("dish_photos_update_own", {
      for: "update",
      to: "public",
      using: ownDishChild,
      withCheck: ownDishChild,
    }),
    pgPolicy("dish_photos_delete_own", {
      for: "delete",
      to: "public",
      using: ownDishChild,
    }),
  ],
).enableRLS();

// ─── Dish Ingredients ────────────────────────────────────────────────────────

export const dishIngredients = pgTable(
  "dish_ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    isAllergen: boolean("is_allergen").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  () => [
    pgPolicy("dish_ingredients_select_public", {
      for: "select",
      to: "public",
      using: dishChildOfActive,
    }),
    pgPolicy("dish_ingredients_select_own", {
      for: "select",
      to: "public",
      using: ownDishChild,
    }),
    pgPolicy("dish_ingredients_insert_own", {
      for: "insert",
      to: "public",
      withCheck: ownDishChild,
    }),
    pgPolicy("dish_ingredients_update_own", {
      for: "update",
      to: "public",
      using: ownDishChild,
      withCheck: ownDishChild,
    }),
    pgPolicy("dish_ingredients_delete_own", {
      for: "delete",
      to: "public",
      using: ownDishChild,
    }),
  ],
).enableRLS();

// ─── Dish Nutrition ──────────────────────────────────────────────────────────
// One-to-one with dishes. All fields optional — cooks fill in what they know.

export const dishNutrition = pgTable(
  "dish_nutrition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dishId: uuid("dish_id")
      .notNull()
      .unique()
      .references(() => dishes.id, { onDelete: "cascade" }),
    calories: integer("calories"),
    proteinG: numeric("protein_g", { precision: 6, scale: 2 }),
    carbsG: numeric("carbs_g", { precision: 6, scale: 2 }),
    fatG: numeric("fat_g", { precision: 6, scale: 2 }),
    saturatedFatG: numeric("saturated_fat_g", { precision: 6, scale: 2 }),
    fiberG: numeric("fiber_g", { precision: 6, scale: 2 }),
    sugarG: numeric("sugar_g", { precision: 6, scale: 2 }),
    sodiumMg: numeric("sodium_mg", { precision: 8, scale: 2 }),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      "nutrition_calories_positive",
      sql`${t.calories} IS NULL OR ${t.calories} >= 0`,
    ),
    check(
      "nutrition_protein_positive",
      sql`${t.proteinG} IS NULL OR ${t.proteinG} >= 0`,
    ),
    check(
      "nutrition_carbs_positive",
      sql`${t.carbsG} IS NULL OR ${t.carbsG} >= 0`,
    ),
    check("nutrition_fat_positive", sql`${t.fatG} IS NULL OR ${t.fatG} >= 0`),
    check(
      "nutrition_satfat_positive",
      sql`${t.saturatedFatG} IS NULL OR ${t.saturatedFatG} >= 0`,
    ),
    check(
      "nutrition_fiber_positive",
      sql`${t.fiberG} IS NULL OR ${t.fiberG} >= 0`,
    ),
    check(
      "nutrition_sugar_positive",
      sql`${t.sugarG} IS NULL OR ${t.sugarG} >= 0`,
    ),
    check(
      "nutrition_sodium_positive",
      sql`${t.sodiumMg} IS NULL OR ${t.sodiumMg} >= 0`,
    ),
    pgPolicy("dish_nutrition_select_public", {
      for: "select",
      to: "public",
      using: dishChildOfActive,
    }),
    pgPolicy("dish_nutrition_select_own", {
      for: "select",
      to: "public",
      using: ownDishChild,
    }),
    pgPolicy("dish_nutrition_insert_own", {
      for: "insert",
      to: "public",
      withCheck: ownDishChild,
    }),
    pgPolicy("dish_nutrition_update_own", {
      for: "update",
      to: "public",
      using: ownDishChild,
      withCheck: ownDishChild,
    }),
  ],
).enableRLS();

// ─── Dish Tags ───────────────────────────────────────────────────────────────

export const dishTags = pgTable(
  "dish_tags",
  {
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.dishId, t.tagId] }),
    pgPolicy("dish_tags_select_public", {
      for: "select",
      to: "public",
      using: sql`dish_id IN (
        SELECT id FROM dishes WHERE status = 'active' AND app_cook_is_public(cook_id)
      )`,
    }),
    pgPolicy("dish_tags_select_own", {
      for: "select",
      to: "public",
      using: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("dish_tags_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("dish_tags_delete_own", {
      for: "delete",
      to: "public",
      using: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
  ],
).enableRLS();

// ─── Dish Promotions ─────────────────────────────────────────────────────────
// One promotion per dish active at a time (partial unique index). The API
// enforces validUntil XOR maxUses; uses_count is incremented by service_role at
// order time. value is always required for both promo types.

export const dishPromotions = pgTable(
  "dish_promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    type: promotionType("type").notNull(),
    // percentage_off: 1–100. fixed_off: positive dollar amount.
    value: numeric("value", { precision: 10, scale: 2 }).notNull(),
    // null = unlimited; mutually exclusive with validUntil (enforced in API).
    maxUses: integer("max_uses"),
    usesCount: integer("uses_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    validFrom: timestamp("valid_from"),
    validUntil: timestamp("valid_until"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // At most one active promotion per dish
    uniqueIndex("dish_promotions_one_active_uidx")
      .on(t.dishId)
      .where(sql`is_active = true`),
    check("dish_promo_value_positive", sql`${t.value} > 0`),
    check(
      "dish_promo_percentage_max",
      sql`${t.type} != 'percentage_off' OR ${t.value} <= 100`,
    ),
    check(
      "dish_promo_max_uses_positive",
      sql`${t.maxUses} IS NULL OR ${t.maxUses} >= 1`,
    ),
    check("dish_promo_uses_count_non_negative", sql`${t.usesCount} >= 0`),
    check(
      "dish_promo_uses_count_cap",
      sql`${t.maxUses} IS NULL OR ${t.usesCount} <= ${t.maxUses}`,
    ),
    check(
      "dish_promo_dates_order",
      sql`${t.validFrom} IS NULL OR ${t.validUntil} IS NULL OR ${t.validUntil} > ${t.validFrom}`,
    ),
    pgPolicy("dish_promotions_select_public", {
      for: "select",
      to: "public",
      using: sql`
        is_active = TRUE
        AND dish_id IN (SELECT id FROM dishes WHERE status = 'active' AND app_cook_is_public(cook_id))
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until > NOW())
        AND (max_uses IS NULL OR uses_count < max_uses)
      `,
    }),
    pgPolicy("dish_promotions_select_own", {
      for: "select",
      to: "public",
      // cook_profiles.user_id is text; auth.uid() is uuid — cast to compare.
      using: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      )`,
    }),
    pgPolicy("dish_promotions_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("dish_promotions_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      )`,
    }),
    pgPolicy("dish_promotions_update_own", {
      for: "update",
      to: "public",
      using: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      )`,
      withCheck: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      )`,
    }),
    pgPolicy("dish_promotions_update_service", {
      for: "update",
      to: "public",
      using: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("dish_promotions_delete_own", {
      for: "delete",
      to: "public",
      using: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      )`,
    }),
  ],
).enableRLS();
