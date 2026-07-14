import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { dishes } from "@/db/schema";
import { getDishLifecycleInfo } from "@/lib/dishes/lifecycle";
import { openOrdersArchiveError } from "@/lib/dishes/lifecycle-messages";
import { isDishDraft, isDishPaused, setDishPaused } from "@/lib/dishes/status";
import { rebuildCookSearchIndexSafe } from "@/lib/search/index-builder";

export type Params = { params: Promise<{ dishId: string }> };

/** Pause a dish (inactive, or archived on legacy schema). */
export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId } = await params;

  try {
    const [dish] = await db
      .select({ id: dishes.id, status: dishes.status })
      .from(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
      .limit(1);

    if (!dish) return notFound("Dish");

    if (isDishDraft(dish.status)) {
      return NextResponse.json(
        { error: "Drafts can't be paused. Publish or delete them instead." },
        { status: 400 },
      );
    }

    if (isDishPaused(dish.status)) {
      return NextResponse.json(
        { error: "Meal is already archived." },
        { status: 400 },
      );
    }

    const lifecycle = await getDishLifecycleInfo(cookId, dishId);
    if (!lifecycle) return notFound("Dish");

    if (lifecycle.openOrderCount > 0) {
      return NextResponse.json(
        {
          error: openOrdersArchiveError(lifecycle.openOrderCount),
          openOrderCount: lifecycle.openOrderCount,
        },
        { status: 409 },
      );
    }

    const updated = await setDishPaused(dishId, cookId);
    if (!updated) return notFound("Dish");

    rebuildCookSearchIndexSafe(cookId);

    return NextResponse.json({
      success: true,
      data: updated,
      hiddenFromBrowse: lifecycle.isLastActiveDish,
    });
  } catch (err) {
    console.error("[dishes/archive]", err);
    return NextResponse.json(
      { error: "Failed to archive dish." },
      { status: 500 },
    );
  }
}
