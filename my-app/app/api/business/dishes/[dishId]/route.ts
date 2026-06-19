import { and, asc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import {
  dishes,
  dishIngredients,
  dishNutrition,
  dishPhotos,
  dishTags,
  orderDishes,
  tags,
} from "@/db/schema";
import { mapDishStatusForDb, normalizeDishStatus } from "@/lib/dish-status";

export type Params = { params: Promise<{ dishId: string }> };

const updateDishSchema = z
  .object({
    name: z.string().min(1).max(255),
    price: z.number().positive().multipleOf(0.01),
    description: z.string().max(2000).optional(),
    cuisine: z.string().max(100).optional(),
    categories: z.array(z.string()).optional().default([]),
    isHalal: z.boolean().optional().default(false),
    isVegan: z.boolean().optional().default(false),
    isVegetarian: z.boolean().optional().default(false),
    isGlutenFree: z.boolean().optional().default(false),
    isDairyFree: z.boolean().optional().default(false),
    isNutFree: z.boolean().optional().default(false),
    isKosher: z.boolean().optional().default(false),
    servingSize: z.string().max(100).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .partial();

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId } = await params;

  try {
    const [dishRow] = await db
      .select({
        dish: dishes,
        listingCount:
          sql<number>`(SELECT COUNT(*)::int FROM listing_dishes WHERE dish_id = ${dishId})`.as(
            "listing_count",
          ),
        totalOrders:
          sql<number>`(SELECT COUNT(DISTINCT order_id)::int FROM order_dishes WHERE dish_id = ${dishId})`.as(
            "total_orders",
          ),
        totalQty:
          sql<number>`(SELECT COALESCE(SUM(quantity), 0)::int FROM order_dishes WHERE dish_id = ${dishId})`.as(
            "total_qty",
          ),
      })
      .from(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
      .limit(1);

    if (!dishRow) return notFound("Dish");

    const dish = dishRow.dish;
    const listingCount = Number(dishRow.listingCount);
    const totalOrders = Number(dishRow.totalOrders);
    const totalQty = Number(dishRow.totalQty);
    const avgQtyPerOrder =
      totalOrders > 0 ? Math.round((totalQty / totalOrders) * 10) / 10 : 0;

    const [photos, ingredients, nutritionRows, tagRows] = await Promise.all([
      db
        .select()
        .from(dishPhotos)
        .where(eq(dishPhotos.dishId, dishId))
        .orderBy(asc(dishPhotos.sortOrder)),

      db
        .select()
        .from(dishIngredients)
        .where(eq(dishIngredients.dishId, dishId))
        .orderBy(asc(dishIngredients.sortOrder)),

      db
        .select()
        .from(dishNutrition)
        .where(eq(dishNutrition.dishId, dishId))
        .limit(1),

      db
        .select({
          id: tags.id,
          slug: tags.slug,
          label: tags.label,
          category: tags.category,
        })
        .from(dishTags)
        .innerJoin(tags, eq(dishTags.tagId, tags.id))
        .where(eq(dishTags.dishId, dishId)),
    ]);

    const nutrition = nutritionRows[0] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        ...dish,
        status: normalizeDishStatus(dish.status),
        photos,
        ingredients,
        nutrition,
        tags: tagRows,
        stats: { listingCount, totalOrders, avgQtyPerOrder },
      },
    });
  } catch (err) {
    console.error("[dishes/id]", err);
    return NextResponse.json(
      { error: "Failed to fetch dish." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = updateDishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  // price is numeric in the DB — stringify it; pass the rest through.
  const { price, status, ...rest } = parsed.data;
  const fields: Record<string, unknown> = {
    ...rest,
    ...(price !== undefined ? { price: String(price) } : {}),
  };
  if (status !== undefined) {
    fields.status = await mapDishStatusForDb(status);
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  try {
    const [dish] = await db
      .select({ id: dishes.id })
      .from(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
      .limit(1);

    if (!dish) return notFound("Dish");

    const [updated] = await db
      .update(dishes)
      .set({ ...fields })
      .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        status: normalizeDishStatus(updated.status),
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "A dish with this name already exists." },
        { status: 409 },
      );
    }
    console.error("[dishes/id]", err);
    return NextResponse.json(
      { error: "Failed to update dish." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId } = await params;

  try {
    const [dish] = await db
      .select({ id: dishes.id })
      .from(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
      .limit(1);

    if (!dish) return notFound("Dish");

    const [orderRef] = await db
      .select({ dishId: orderDishes.dishId })
      .from(orderDishes)
      .where(eq(orderDishes.dishId, dishId))
      .limit(1);

    if (orderRef) {
      return NextResponse.json(
        {
          error:
            "This meal has been ordered before and cannot be deleted. Archive it instead.",
        },
        { status: 409 },
      );
    }

    await db
      .delete(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[dishes/id/delete]", err);
    return NextResponse.json(
      { error: "Failed to delete dish." },
      { status: 500 },
    );
  }
}
