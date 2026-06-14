import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { listingPromotions, listings } from "@/db/schema";

type Params = { params: Promise<{ listingId: string; promotionId: string }> };

const updatePromotionSchema = z
  .object({
    type: z.enum(["percentage_off", "fixed_off"]),
    value: z.number().positive().nullable(),
    minimumQty: z.number().int().min(1),
    maxUses: z.number().int().min(1).nullable(),
    isActive: z.boolean(),
    validFrom: z.string().datetime().nullable(),
    validUntil: z.string().datetime().nullable(),
  })
  .partial();

export async function PATCH(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId, promotionId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const { usesCount: _ignored, ...safeBody } = body as Record<string, unknown>;

  const parsed = updatePromotionSchema.safeParse(safeBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  try {
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);
    if (!listing) return notFound("Listing");

    const [promo] = await db
      .select({ id: listingPromotions.id })
      .from(listingPromotions)
      .where(
        and(
          eq(listingPromotions.id, promotionId),
          eq(listingPromotions.listingId, listingId),
        ),
      )
      .limit(1);
    if (!promo) return notFound("Promotion");

    const updateData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(parsed.data)) {
      if (val !== undefined) {
        if (
          (key === "validFrom" || key === "validUntil") &&
          typeof val === "string"
        ) {
          updateData[key] = new Date(val);
        } else {
          updateData[key] = val;
        }
      }
    }

    const [updated] = await db
      .update(listingPromotions)
      .set(updateData)
      .where(
        and(
          eq(listingPromotions.id, promotionId),
          eq(listingPromotions.listingId, listingId),
        ),
      )
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[promotions]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId, promotionId } = await params;

  try {
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);
    if (!listing) return notFound("Listing");

    const [promo] = await db
      .select({ id: listingPromotions.id })
      .from(listingPromotions)
      .where(
        and(
          eq(listingPromotions.id, promotionId),
          eq(listingPromotions.listingId, listingId),
        ),
      )
      .limit(1);
    if (!promo) return notFound("Promotion");

    await db
      .delete(listingPromotions)
      .where(
        and(
          eq(listingPromotions.id, promotionId),
          eq(listingPromotions.listingId, listingId),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[promotions]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
