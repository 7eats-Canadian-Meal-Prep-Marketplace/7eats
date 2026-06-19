import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { dishes, dishPromotions } from "@/db/schema";
import { logAndCheckRateLimit } from "@/lib/rate-limit";
import { validatePromotionWindow } from "./_validate";

type Params = { params: Promise<{ dishId: string }> };

const baseFields = {
  maxUses: z.number().int().min(1).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
};

const createSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("percentage_off"),
    value: z.number().min(1).max(100),
    ...baseFields,
  }),
  z.object({
    type: z.literal("fixed_off"),
    value: z.number().positive(),
    ...baseFields,
  }),
]);

async function ownDish(dishId: string, cookId: string) {
  const [d] = await db
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
    .limit(1);
  return d ?? null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();
  const { dishId } = await params;
  if (!(await ownDish(dishId, cookId))) return notFound("Dish");

  const rows = await db
    .select()
    .from(dishPromotions)
    .where(eq(dishPromotions.dishId, dishId))
    .orderBy(asc(dishPromotions.createdAt));
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();
  const { dishId } = await params;

  const withinLimit = await logAndCheckRateLimit(`promo:${cookId}`, {
    windowMinutes: 10,
    maxAttempts: 30,
  });
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many promotion changes. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }
  const win = validatePromotionWindow({
    maxUses: parsed.data.maxUses,
    validUntil: parsed.data.validUntil,
  });
  if (!win.ok) return NextResponse.json({ error: win.error }, { status: 422 });

  if (!(await ownDish(dishId, cookId))) return notFound("Dish");

  try {
    // Only one promotion may be active per dish — deactivate the current one
    // before inserting the new active promotion (also guarded by a partial
    // unique index at the DB level).
    const inserted = await db.transaction(async (tx) => {
      await tx
        .update(dishPromotions)
        .set({ isActive: false })
        .where(
          and(
            eq(dishPromotions.dishId, dishId),
            eq(dishPromotions.isActive, true),
          ),
        );
      const [row] = await tx
        .insert(dishPromotions)
        .values({
          dishId,
          type: parsed.data.type,
          value: String(parsed.data.value),
          isActive: true,
          ...(parsed.data.maxUses !== undefined
            ? { maxUses: parsed.data.maxUses }
            : {}),
          ...(parsed.data.validFrom
            ? { validFrom: new Date(parsed.data.validFrom) }
            : {}),
          ...(parsed.data.validUntil
            ? { validUntil: new Date(parsed.data.validUntil) }
            : {}),
        } as typeof dishPromotions.$inferInsert)
        .returning();
      return row;
    });
    return NextResponse.json(
      { success: true, data: inserted },
      { status: 201 },
    );
  } catch (err) {
    console.error("[dish-promotions POST]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
