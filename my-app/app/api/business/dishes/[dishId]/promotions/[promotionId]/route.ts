import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { dishes, dishPromotions } from "@/db/schema";
import { validatePromotionWindow } from "../_validate";

type Params = { params: Promise<{ dishId: string; promotionId: string }> };

const patchSchema = z.object({
  value: z.number().positive().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

async function loadOwned(dishId: string, promotionId: string, cookId: string) {
  const [row] = await db
    .select({
      id: dishPromotions.id,
      type: dishPromotions.type,
      maxUses: dishPromotions.maxUses,
      usesCount: dishPromotions.usesCount,
      validUntil: dishPromotions.validUntil,
    })
    .from(dishPromotions)
    .innerJoin(dishes, eq(dishPromotions.dishId, dishes.id))
    .where(
      and(
        eq(dishPromotions.id, promotionId),
        eq(dishPromotions.dishId, dishId),
        eq(dishes.cookId, cookId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();
  const { dishId, promotionId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const current = await loadOwned(dishId, promotionId, cookId);
  if (!current) return notFound("Promotion");

  const nextMaxUses =
    parsed.data.maxUses !== undefined ? parsed.data.maxUses : current.maxUses;
  const nextValidUntil =
    parsed.data.validUntil !== undefined
      ? parsed.data.validUntil
      : (current.validUntil?.toISOString() ?? null);

  const win = validatePromotionWindow({
    maxUses: nextMaxUses,
    validUntil: nextValidUntil,
  });
  if (!win.ok) return NextResponse.json({ error: win.error }, { status: 422 });
  if (nextMaxUses != null && nextMaxUses < current.usesCount) {
    return NextResponse.json(
      { error: "Max redemptions cannot be below current usage." },
      { status: 422 },
    );
  }
  if (
    parsed.data.value != null &&
    current.type === "percentage_off" &&
    parsed.data.value > 100
  ) {
    return NextResponse.json(
      { error: "Percentage cannot exceed 100." },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(dishPromotions)
    .set({
      ...(parsed.data.value != null
        ? { value: String(parsed.data.value) }
        : {}),
      maxUses: nextMaxUses ?? null,
      validUntil: nextValidUntil ? new Date(nextValidUntil) : null,
    })
    .where(eq(dishPromotions.id, promotionId))
    .returning();
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();
  const { dishId, promotionId } = await params;

  const current = await loadOwned(dishId, promotionId, cookId);
  if (!current) return notFound("Promotion");

  if (current.usesCount === 0) {
    await db.delete(dishPromotions).where(eq(dishPromotions.id, promotionId));
    return NextResponse.json({ success: true, data: { deleted: true } });
  }
  // Already redeemed — keep the row for order_dishes history; just deactivate.
  await db
    .update(dishPromotions)
    .set({ isActive: false })
    .where(eq(dishPromotions.id, promotionId));
  return NextResponse.json({
    success: true,
    data: { deleted: false, deactivated: true },
  });
}
