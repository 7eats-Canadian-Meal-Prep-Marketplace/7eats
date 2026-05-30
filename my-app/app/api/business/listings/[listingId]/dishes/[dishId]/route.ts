import { and, eq, ne } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { listingDishes, listings, orders } from "@/db/schema";

type Params = { params: Promise<{ listingId: string; dishId: string }> };

const updateDishInListingSchema = z
  .object({
    quantity: z.number().int().min(1),
    sortOrder: z.number().int(),
  })
  .partial();

export async function PATCH(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId, dishId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = updateDishInListingSchema.safeParse(body);
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

  const [listing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
    .limit(1);
  if (!listing) return notFound("Listing");

  const [entry] = await db
    .select({ id: listingDishes.id })
    .from(listingDishes)
    .where(
      and(
        eq(listingDishes.listingId, listingId),
        eq(listingDishes.dishId, dishId),
      ),
    )
    .limit(1);
  if (!entry) return notFound("Dish in listing");

  try {
    const [updated] = await db
      .update(listingDishes)
      .set({ ...parsed.data })
      .where(
        and(
          eq(listingDishes.listingId, listingId),
          eq(listingDishes.dishId, dishId),
        ),
      )
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[listing-dishes]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId, dishId } = await params;

  const [listing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
    .limit(1);
  if (!listing) return notFound("Listing");

  const [activeOrder] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.listingId, listingId), ne(orders.status, "cancelled")))
    .limit(1);
  if (activeOrder) {
    return NextResponse.json(
      { error: "Cannot change composition while active orders exist." },
      { status: 409 },
    );
  }

  try {
    await db
      .delete(listingDishes)
      .where(
        and(
          eq(listingDishes.listingId, listingId),
          eq(listingDishes.dishId, dishId),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[listing-dishes]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
