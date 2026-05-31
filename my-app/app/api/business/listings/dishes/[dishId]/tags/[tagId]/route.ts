import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { dishes, dishTags } from "@/db/schema";

type Params = { params: Promise<{ dishId: string; tagId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId, tagId } = await params;

  const [dish] = await db
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
    .limit(1);

  if (!dish) return notFound("Dish");

  try {
    await db
      .delete(dishTags)
      .where(and(eq(dishTags.dishId, dishId), eq(dishTags.tagId, tagId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[dishes/tags/id]", err);
    return NextResponse.json(
      { error: "Failed to detach tag." },
      { status: 500 },
    );
  }
}
