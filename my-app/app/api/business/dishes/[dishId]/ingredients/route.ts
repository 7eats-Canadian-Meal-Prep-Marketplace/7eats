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

type Params = { params: Promise<{ dishId: string }> };

const addIngredientSchema = z
  .object({
    name: z.string().min(1).max(255),
    quantity: z.string().max(100).optional(),
    isAllergen: z.boolean().optional().default(false),
    sortOrder: z.number().int().optional().default(0),
  })
  .strict();

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId } = await params;

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

  const parsed = addIngredientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  try {
    const [ingredient] = await db
      .insert(dishIngredients)
      .values({
        dishId,
        name: parsed.data.name,
        quantity: parsed.data.quantity ?? null,
        isAllergen: parsed.data.isAllergen,
        sortOrder: parsed.data.sortOrder,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: ingredient },
      { status: 201 },
    );
  } catch (err) {
    console.error("[dishes/ingredients]", err);
    return NextResponse.json(
      { error: "Failed to add ingredient." },
      { status: 500 },
    );
  }
}
