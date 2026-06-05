import { json, pgPolicy, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

// Mirrors the live `user_preferences` table, which was created directly in Neon
// (outside Drizzle migrations). Defined here for typed, read-only access from the
// cook-facing preference sheet API. The table already exists with these exact
// columns and RLS policies — do NOT run `drizzle-kit push` for this table.
//
// Clients populate these arrays during consumer onboarding; the business side only
// reads them.
export const userPreferences = pgTable(
  "user_preferences",
  {
    id: text("id").primaryKey(),
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
    // Permissive policies as they exist in the live database. Server-side reads run
    // as table owner and bypass RLS; these remain for direct/edge access parity.
    pgPolicy("user_prefs_own", { for: "all", to: "public" }),
    pgPolicy("user_prefs_admin", { for: "all", to: "public" }),
  ],
).enableRLS();
