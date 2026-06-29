import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { dishes, orderDishes, orders } from "@/db/schema";
import type { UnavailableOrderDish } from "@/lib/dishes/lifecycle-messages";
import { isDishPaused } from "@/lib/dishes/status-core";

export type { UnavailableOrderDish } from "@/lib/dishes/lifecycle-messages";

/** Orders that must finish before a meal can be paused. */
export const DISH_BLOCKING_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "ready",
] as const;

export type DishLifecycleInfo = {
  totalOrders: number;
  openOrderCount: number;
  isLastActiveDish: boolean;
  canDelete: boolean;
};

export async function getDishLifecycleInfo(
  cookId: string,
  dishId: string,
): Promise<DishLifecycleInfo | null> {
  const [dish] = await db
    .select({ id: dishes.id, status: dishes.status })
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
    .limit(1);

  if (!dish) return null;

  const [[orderStats], [otherActive]] = await Promise.all([
    db
      .select({
        totalOrders: sql<number>`COUNT(DISTINCT ${orderDishes.orderId})::int`,
        openOrderCount: sql<number>`COUNT(DISTINCT ${orderDishes.orderId}) FILTER (WHERE ${orders.status} IN ('pending', 'confirmed', 'ready'))::int`,
      })
      .from(orderDishes)
      .leftJoin(orders, eq(orderDishes.orderId, orders.id))
      .where(eq(orderDishes.dishId, dishId)),
    db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(dishes)
      .where(
        and(
          eq(dishes.cookId, cookId),
          eq(dishes.status, "active"),
          ne(dishes.id, dishId),
        ),
      ),
  ]);

  const totalOrders = Number(orderStats?.totalOrders ?? 0);
  const openOrderCount = Number(orderStats?.openOrderCount ?? 0);
  const isLastActiveDish =
    !isDishPaused(dish.status) && Number(otherActive?.count ?? 0) === 0;

  return {
    totalOrders,
    openOrderCount,
    isLastActiveDish,
    canDelete: totalOrders === 0,
  };
}

export async function resolveUnavailableOrderDishes(
  cookId: string,
  dishIds: string[],
): Promise<UnavailableOrderDish[]> {
  if (dishIds.length === 0) return [];

  const rows = await db
    .select({ id: dishes.id, name: dishes.name, status: dishes.status })
    .from(dishes)
    .where(and(inArray(dishes.id, dishIds), eq(dishes.cookId, cookId)));

  const byId = new Map(rows.map((row) => [row.id, row]));
  const unavailable: UnavailableOrderDish[] = [];

  for (const dishId of dishIds) {
    const row = byId.get(dishId);
    if (!row) {
      unavailable.push({
        dishId,
        name: "A meal in your cart",
        reason: "not_found",
      });
      continue;
    }
    if (isDishPaused(row.status)) {
      unavailable.push({
        dishId: row.id,
        name: row.name,
        reason: "paused",
      });
    }
  }

  return unavailable;
}
