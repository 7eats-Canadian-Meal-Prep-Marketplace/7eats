import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { dishes, dishIngredients } from "@/db/schema";

type Params = { params: Promise<{ dishId: string; ingredientId: string }> };

const updateIngredientSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    isAllergen: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId, ingredientId } = await params;

  const [dish] = await db
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
    .limit(1);

  if (!dish) return notFound("Dish");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = updateIngredientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { name, isAllergen, sortOrder } = parsed.data;
  const hasFields =
    name !== undefined || isAllergen !== undefined || sortOrder !== undefined;

  if (!hasFields) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: dishIngredients.id })
    .from(dishIngredients)
    .where(
      and(
        eq(dishIngredients.id, ingredientId),
        eq(dishIngredients.dishId, dishId),
      ),
    )
    .limit(1);

  if (!existing) return notFound("Ingredient");

  try {
    const updateValues: Partial<{
      name: string;
      isAllergen: boolean;
      sortOrder: number;
    }> = {};

    if (name !== undefined) updateValues.name = name;
    if (isAllergen !== undefined) updateValues.isAllergen = isAllergen;
    if (sortOrder !== undefined) updateValues.sortOrder = sortOrder;

    const [updated] = await db
      .update(dishIngredients)
      .set(updateValues)
      .where(
        and(
          eq(dishIngredients.id, ingredientId),
          eq(dishIngredients.dishId, dishId),
        ),
      )
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[dishes/ingredients/id]", err);
    return NextResponse.json(
      { error: "Failed to update ingredient." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId, ingredientId } = await params;

  const [dish] = await db
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
    .limit(1);

  if (!dish) return notFound("Dish");

  try {
    await db
      .delete(dishIngredients)
      .where(
        and(
          eq(dishIngredients.id, ingredientId),
          eq(dishIngredients.dishId, dishId),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[dishes/ingredients/id]", err);
    return NextResponse.json(
      { error: "Failed to delete ingredient." },
      { status: 500 },
    );
  }
}
