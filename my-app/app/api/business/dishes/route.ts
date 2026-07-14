import { desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db, dbPool } from "@/db";
import { dishes, dishIngredients, dishNutrition } from "@/db/schema";
import {
  type DishStatus,
  dishStatusFilter,
  mapDishStatusForDb,
  normalizeDishStatus,
} from "@/lib/dishes/status";
import { rebuildCookSearchIndexSafe } from "@/lib/search/index-builder";

const VALID_STATUSES = ["active", "inactive", "draft"] as const;

const nutritionSchema = z
  .object({
    calories: z.number().int().min(0).optional(),
    proteinG: z.number().min(0).optional(),
    carbsG: z.number().min(0).optional(),
    fatG: z.number().min(0).optional(),
  })
  .optional();

const createDishBaseSchema = z.object({
  name: z.string().trim().min(1).max(255),
  price: z.number().nonnegative().multipleOf(0.01).optional(),
  description: z.string().max(500).optional(),
  categories: z.array(z.string()).optional().default([]),
  isHalal: z.boolean().optional().default(false),
  isVegan: z.boolean().optional().default(false),
  isVegetarian: z.boolean().optional().default(false),
  isGlutenFree: z.boolean().optional().default(false),
  isDairyFree: z.boolean().optional().default(false),
  isNutFree: z.boolean().optional().default(false),
  isKosher: z.boolean().optional().default(false),
  servingSize: z.string().max(100).optional(),
  status: z.enum(["active", "inactive", "draft"]).optional().default("active"),
  ingredients: z
    .array(z.object({ name: z.string().min(1).max(255) }))
    .optional()
    .default([]),
  allergens: z.array(z.string().min(1).max(255)).optional().default([]),
  allergenNoneApplies: z.boolean().optional().default(false),
  nutrition: nutritionSchema,
});

const createDishSchema = createDishBaseSchema.superRefine((data, ctx) => {
  if (data.status === "draft") return;

  if (data.price === undefined || data.price <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Price must be greater than 0.",
      path: ["price"],
    });
  }

  if (data.allergens.length === 0 && !data.allergenNoneApplies) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Allergen declaration is required.",
      path: ["allergens"],
    });
  }
});

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");

  const validStatus =
    statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as DishStatus)
      : null;

  try {
    const conditions = validStatus
      ? dishStatusFilter(cookId, validStatus)
      : eq(dishes.cookId, cookId);

    const rows = await db
      .select({
        dish: dishes,
        totalOrders:
          sql<number>`(SELECT COUNT(DISTINCT order_id)::int FROM order_dishes WHERE dish_id = ${dishes.id})`.as(
            "total_orders",
          ),
      })
      .from(dishes)
      .where(conditions)
      .orderBy(desc(dishes.createdAt));

    return NextResponse.json({
      success: true,
      data: rows.map(({ dish, totalOrders }) => ({
        ...dish,
        status: normalizeDishStatus(dish.status),
        totalOrders: Number(totalOrders),
        canDelete: Number(totalOrders) === 0,
      })),
    });
  } catch (err) {
    console.error("[dishes]", err);
    return NextResponse.json(
      { error: "Failed to fetch dishes." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = createDishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const {
    price,
    status,
    ingredients,
    allergens,
    allergenNoneApplies: _none,
    nutrition,
    ...rest
  } = parsed.data;

  const priceValue =
    status === "draft"
      ? String((price ?? 0).toFixed(2))
      : String((price as number).toFixed(2));

  try {
    const dbStatus = await mapDishStatusForDb(status);
    const inserted = await dbPool.transaction(async (tx) => {
      const [dish] = await tx
        .insert(dishes)
        .values({
          cookId,
          ...rest,
          price: priceValue,
          status: dbStatus as "active" | "inactive" | "draft",
        })
        .returning();

      const ingredientRows = ingredients.map((ing, i) => ({
        dishId: dish.id,
        name: ing.name,
        isAllergen: false,
        sortOrder: i,
      }));

      const allergenRows = allergens.map((name, i) => ({
        dishId: dish.id,
        name,
        isAllergen: true,
        sortOrder: ingredients.length + i,
      }));

      if (ingredientRows.length > 0 || allergenRows.length > 0) {
        await tx
          .insert(dishIngredients)
          .values([...ingredientRows, ...allergenRows]);
      }

      if (nutrition && Object.values(nutrition).some((v) => v !== undefined)) {
        await tx.insert(dishNutrition).values({
          dishId: dish.id,
          calories: nutrition.calories,
          proteinG:
            nutrition.proteinG !== undefined
              ? String(nutrition.proteinG)
              : undefined,
          carbsG:
            nutrition.carbsG !== undefined
              ? String(nutrition.carbsG)
              : undefined,
          fatG:
            nutrition.fatG !== undefined ? String(nutrition.fatG) : undefined,
        });
      }

      return dish;
    });

    // Drafts are not public — only reindex when publishing/creating active meals.
    if (status !== "draft") {
      rebuildCookSearchIndexSafe(cookId);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...inserted,
          status: normalizeDishStatus(inserted.status),
        },
      },
      { status: 201 },
    );
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
    console.error("[dishes]", err);
    return NextResponse.json(
      { error: "Could not save your meal. Please try again." },
      { status: 500 },
    );
  }
}
