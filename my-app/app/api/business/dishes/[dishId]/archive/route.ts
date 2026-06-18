import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { dishes } from "@/db/schema";

export type Params = { params: Promise<{ dishId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId } = await params;

  try {
    const [dish] = await db
      .select({ id: dishes.id, status: dishes.status })
      .from(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
      .limit(1);

    if (!dish) return notFound("Dish");

    if (dish.status === "archived") {
      return NextResponse.json(
        { error: "Dish is already archived." },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(dishes)
      .set({ status: "archived" })
      .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[dishes/archive]", err);
    return NextResponse.json(
      { error: "Failed to archive dish." },
      { status: 500 },
    );
  }
}
