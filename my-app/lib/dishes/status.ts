import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { dishes } from "@/db/schema";
import { type DishStatus, normalizeDishStatus } from "@/lib/dishes/status-core";

export type { DishStatus } from "@/lib/dishes/status-core";
export {
  isDishDraft,
  isDishOrderable,
  isDishPaused,
  normalizeDishStatus,
} from "@/lib/dishes/status-core";

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
): Promise<"active" | "inactive" | "archived" | "draft"> {
  if (status === "active") return "active";
  if (status === "draft") return "draft";
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

/** Filter dishes by status for the cook dashboard. */
export function dishStatusFilter(cookId: string, status: DishStatus) {
  if (status === "inactive") {
    // Prefer exact inactive; legacy archived rows (pre-0005) also count as inactive.
    return and(
      eq(dishes.cookId, cookId),
      sql`${dishes.status}::text IN ('inactive', 'archived')`,
    );
  }
  return and(eq(dishes.cookId, cookId), eq(dishes.status, status));
}
