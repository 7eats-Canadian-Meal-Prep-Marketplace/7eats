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

const toggleSchema = z.object({
  isActive: z.boolean(),
});

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

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
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

    const [updated] = await db
      .update(listingPromotions)
      .set({ isActive: parsed.data.isActive })
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
