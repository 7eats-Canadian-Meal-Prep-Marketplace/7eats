import { sql } from "drizzle-orm";
import { json, pgPolicy, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => authUser.id, { onDelete: "cascade" }),
    dietary: json("dietary").$type<string[]>().notNull(),
    allergies: json("allergies").$type<string[]>().notNull(),
    goals: json("goals").$type<string[]>().notNull(),
    whyMealPrep: json("why_meal_prep").$type<string[]>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [
    pgPolicy("user_prefs_own", {
      for: "all",
      to: "public",
      using: sql`user_id = auth.uid()::text`,
      withCheck: sql`user_id = auth.uid()::text`,
    }),
    pgPolicy("user_prefs_admin", {
      for: "all",
      to: "public",
      using: sql`auth.role() = 'admin'`,
    }),
  ],
).enableRLS();
