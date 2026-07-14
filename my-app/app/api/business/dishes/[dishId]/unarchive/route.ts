import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { dishes } from "@/db/schema";
import { isDishDraft, isDishPaused, setDishActive } from "@/lib/dishes/status";
import { rebuildCookSearchIndexSafe } from "@/lib/search/index-builder";

export type Params = { params: Promise<{ dishId: string }> };

/** Restore a paused dish to active. */
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
        {
          error:
            "Open the draft and use Publish meal after photos and details are complete.",
        },
        { status: 400 },
      );
    }

    if (!isDishPaused(dish.status)) {
      return NextResponse.json(
        { error: "Meal is already active." },
        { status: 400 },
      );
    }

    const updated = await setDishActive(dishId, cookId);
    if (!updated) return notFound("Dish");

    // Re-activating a dish can restore the cook's search visibility.
    rebuildCookSearchIndexSafe(cookId);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[dishes/unarchive]", err);
    return NextResponse.json(
      { error: "Failed to unarchive dish." },
      { status: 500 },
    );
  }
}
