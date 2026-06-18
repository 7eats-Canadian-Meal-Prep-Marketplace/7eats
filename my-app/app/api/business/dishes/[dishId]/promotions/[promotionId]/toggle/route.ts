import { and, eq, ne } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { dishes, dishPromotions } from "@/db/schema";

type Params = { params: Promise<{ dishId: string; promotionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();
  const { dishId, promotionId } = await params;

  const [row] = await db
    .select({ id: dishPromotions.id, isActive: dishPromotions.isActive })
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
  if (!row) return notFound("Promotion");

  const next = !row.isActive;
  await db.transaction(async (tx) => {
    if (next) {
      // Activating: ensure no other active promotion remains for this dish.
      await tx
        .update(dishPromotions)
        .set({ isActive: false })
        .where(
          and(
            eq(dishPromotions.dishId, dishId),
            ne(dishPromotions.id, promotionId),
          ),
        );
    }
    await tx
      .update(dishPromotions)
      .set({ isActive: next })
      .where(eq(dishPromotions.id, promotionId));
  });
  return NextResponse.json({ success: true, data: { isActive: next } });
}
