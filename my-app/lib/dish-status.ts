import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { dishes } from "@/db/schema";

export type DishStatus = "active" | "inactive";

/** Legacy DB values mapped to the current active/inactive model. */
export function normalizeDishStatus(raw: string): DishStatus {
  if (raw === "inactive" || raw === "archived") return "inactive";
  return "active";
}

export function isDishPaused(raw: string): boolean {
  return raw === "inactive" || raw === "archived";
}

let pausedDbLabel: "inactive" | "archived" | null = null;

/** Which enum label the database uses for a paused/hidden dish. */
export async function getPausedDishStatusValue(): Promise<
  "inactive" | "archived"
> {
  if (pausedDbLabel) return pausedDbLabel;

  try {
    await db.execute(sql`SELECT 'inactive'::dish_status AS v`);
    pausedDbLabel = "inactive";
  } catch {
    pausedDbLabel = "archived";
  }

  return pausedDbLabel;
}

export async function mapDishStatusForDb(
  status: DishStatus,
): Promise<"active" | "inactive" | "archived"> {
  if (status === "active") return "active";
  return getPausedDishStatusValue();
}

export async function setDishPaused(dishId: string, cookId: string) {
  const paused = await getPausedDishStatusValue();
  const [updated] = await db
    .update(dishes)
    .set({ status: paused as "inactive" })
    .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
    .returning();

  return updated
    ? { ...updated, status: normalizeDishStatus(updated.status) }
    : undefined;
}

export async function setDishActive(dishId: string, cookId: string) {
  const [updated] = await db
    .update(dishes)
    .set({ status: "active" })
    .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
    .returning();

  return updated
    ? { ...updated, status: normalizeDishStatus(updated.status) }
    : undefined;
}

/** Filter dishes by active/inactive for the cook dashboard. */
export function dishStatusFilter(cookId: string, status: DishStatus) {
  return and(eq(dishes.cookId, cookId), eq(dishes.status, status));
}
