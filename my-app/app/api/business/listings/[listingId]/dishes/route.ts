import { and, eq, ne } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { dishes, listingDishes, listings } from "@/db/schema";

type Params = { params: Promise<{ listingId: string }> };

const addDishSchema = z.object({
  dishId: z.string().uuid(),
  quantity: z.number().int().min(1).optional().default(1),
  sortOrder: z.number().int().optional().default(0),
});

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = addDishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const [listing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
    .limit(1);
  if (!listing) return notFound("Listing");

  const [dish] = await db
    .select({ id: dishes.id })
    .from(dishes)
    .where(
      and(
        eq(dishes.id, parsed.data.dishId),
        eq(dishes.cookId, cookId),
        ne(dishes.status, "archived"),
      ),
    )
    .limit(1);
  if (!dish) return notFound("Dish");

  try {
    const [inserted] = await db
      .insert(listingDishes)
      .values({
        listingId,
        dishId: parsed.data.dishId,
        quantity: parsed.data.quantity,
        sortOrder: parsed.data.sortOrder,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: inserted },
      { status: 201 },
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "Dish is already in this listing." },
        { status: 409 },
      );
    }
    console.error("[listing-dishes]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
