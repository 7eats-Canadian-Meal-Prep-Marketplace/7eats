import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { dishes } from "@/db/schema";

const VALID_STATUSES = ["draft", "active", "archived"] as const;
type DishStatus = (typeof VALID_STATUSES)[number];

const createDishSchema = z.object({
  name: z.string().min(1).max(255),
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
      ? and(eq(dishes.cookId, cookId), eq(dishes.status, validStatus))
      : eq(dishes.cookId, cookId);

    const rows = await db
      .select()
      .from(dishes)
      .where(conditions)
      .orderBy(desc(dishes.createdAt));

    return NextResponse.json({ success: true, data: rows });
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

  try {
    const [inserted] = await db
      .insert(dishes)
      .values({
        cookId,
        ...parsed.data,
        status: "draft",
      })
      .returning();

    return NextResponse.json(
      { success: true, data: inserted },
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
      { error: "Failed to create dish." },
      { status: 500 },
    );
  }
}
