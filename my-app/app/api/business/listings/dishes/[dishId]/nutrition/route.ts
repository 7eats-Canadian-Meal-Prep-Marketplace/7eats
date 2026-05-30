import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { dishes, dishNutrition } from "@/db/schema";

const upsertNutritionSchema = z
  .object({
    calories: z.number().int().nonnegative().optional(),
    proteinG: z.number().nonnegative().optional(),
    carbsG: z.number().nonnegative().optional(),
    fatG: z.number().nonnegative().optional(),
    saturatedFatG: z.number().nonnegative().optional(),
    fiberG: z.number().nonnegative().optional(),
    sugarG: z.number().nonnegative().optional(),
    sodiumMg: z.number().nonnegative().optional(),
  })
  .strict();

type Params = { params: Promise<{ dishId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
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

  const parsed = upsertNutritionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const insertValues = {
    dishId,
    calories: data.calories,
    proteinG: data.proteinG?.toString(),
    carbsG: data.carbsG?.toString(),
    fatG: data.fatG?.toString(),
    saturatedFatG: data.saturatedFatG?.toString(),
    fiberG: data.fiberG?.toString(),
    sugarG: data.sugarG?.toString(),
    sodiumMg: data.sodiumMg?.toString(),
  };

  // Build the conflict-update set only from keys present in the request.
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (data.calories !== undefined) updateSet.calories = data.calories;
  if (data.proteinG !== undefined)
    updateSet.proteinG = data.proteinG.toString();
  if (data.carbsG !== undefined) updateSet.carbsG = data.carbsG.toString();
  if (data.fatG !== undefined) updateSet.fatG = data.fatG.toString();
  if (data.saturatedFatG !== undefined)
    updateSet.saturatedFatG = data.saturatedFatG.toString();
  if (data.fiberG !== undefined) updateSet.fiberG = data.fiberG.toString();
  if (data.sugarG !== undefined) updateSet.sugarG = data.sugarG.toString();
  if (data.sodiumMg !== undefined)
    updateSet.sodiumMg = data.sodiumMg.toString();

  try {
    const [row] = await db
      .insert(dishNutrition)
      .values(insertValues)
      .onConflictDoUpdate({
        target: dishNutrition.dishId,
        set: updateSet,
      })
      .returning();

    return NextResponse.json({ success: true, data: row });
  } catch (err) {
    console.error("[dishes/nutrition]", err);
    return NextResponse.json(
      { error: "Failed to save nutrition info." },
      { status: 500 },
    );
  }
}
