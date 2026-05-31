import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import {
  dishes,
  listingDishes,
  listingSubscriptionTiers,
  listings,
} from "@/db/schema";

export type Params = { params: Promise<{ listingId: string }> };

const updateListingSchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    basePrice: z.number().positive(),
    currency: z.string().length(3),
    coverPhotoUrl: z.url().nullable(),
    minOrderQty: z.number().int().min(1),
    maxOrderQty: z.number().int().nullable(),
    cancellationNoticeDays: z.number().int().min(0).nullable(),
  })
  .partial();

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId } = await params;

  try {
    const [listing] = await db
      .select()
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!listing) return notFound("Listing");

    const dishRows = await db
      .select({
        id: listingDishes.id,
        dishId: listingDishes.dishId,
        name: dishes.name,
        quantity: listingDishes.quantity,
        sortOrder: listingDishes.sortOrder,
        dishStatus: dishes.status,
      })
      .from(listingDishes)
      .innerJoin(dishes, eq(listingDishes.dishId, dishes.id))
      .where(eq(listingDishes.listingId, listingId))
      .orderBy(asc(listingDishes.sortOrder));

    const tierRows = await db
      .select()
      .from(listingSubscriptionTiers)
      .where(eq(listingSubscriptionTiers.listingId, listingId))
      .orderBy(listingSubscriptionTiers.interval);

    return NextResponse.json({
      success: true,
      data: { ...listing, dishes: dishRows, tiers: tierRows },
    });
  } catch (err) {
    console.error("[listings]", err);
    return NextResponse.json(
      { error: "Failed to fetch listing." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
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

  const parsed = updateListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { basePrice, ...rest } = parsed.data;
  const fields = {
    ...rest,
    ...(basePrice !== undefined ? { basePrice: String(basePrice) } : {}),
  };
  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  try {
    const [existing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!existing) return notFound("Listing");

    const [updated] = await db
      .update(listings)
      .set(fields)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[listings]", err);
    return NextResponse.json(
      { error: "Failed to update listing." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId } = await params;

  try {
    const [listing] = await db
      .select()
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!listing) return notFound("Listing");

    if (listing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft listings can be deleted." },
        { status: 400 },
      );
    }

    await db
      .delete(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[listings]", err);
    return NextResponse.json(
      { error: "Failed to delete listing." },
      { status: 500 },
    );
  }
}
