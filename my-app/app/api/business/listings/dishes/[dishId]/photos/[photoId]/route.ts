import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db, dbPool } from "@/db";
import { dishes, dishPhotos } from "@/db/schema";

type Params = { params: Promise<{ dishId: string; photoId: string }> };

const patchSchema = z
  .object({
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

export async function PATCH(req: Request, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId, photoId } = await params;

  try {
    // Verify dish ownership
    const [dish] = await db
      .select({ id: dishes.id })
      .from(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
      .limit(1);

    if (!dish) return notFound("Dish");

    // Validate body
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const updateFields = parsed.data;

    // Require at least one field
    if (
      updateFields.isPrimary === undefined &&
      updateFields.sortOrder === undefined
    ) {
      return NextResponse.json(
        { error: "No fields to update." },
        { status: 400 },
      );
    }

    // Verify photo exists and belongs to this dish
    const [existingPhoto] = await db
      .select({ id: dishPhotos.id })
      .from(dishPhotos)
      .where(and(eq(dishPhotos.id, photoId), eq(dishPhotos.dishId, dishId)))
      .limit(1);

    if (!existingPhoto) return notFound("Photo");

    if (updateFields.isPrimary === true) {
      // Transaction: clear existing primary, update this photo
      const photo = await dbPool.transaction(async (tx) => {
        await tx
          .update(dishPhotos)
          .set({ isPrimary: false })
          .where(eq(dishPhotos.dishId, dishId));

        const [updated] = await tx
          .update(dishPhotos)
          .set(updateFields)
          .where(and(eq(dishPhotos.id, photoId), eq(dishPhotos.dishId, dishId)))
          .returning();

        return updated;
      });

      return NextResponse.json({ success: true, data: photo });
    }

    // Simple update — no primary change
    const [photo] = await db
      .update(dishPhotos)
      .set(updateFields)
      .where(and(eq(dishPhotos.id, photoId), eq(dishPhotos.dishId, dishId)))
      .returning();

    return NextResponse.json({ success: true, data: photo });
  } catch (error) {
    console.error("[dishes/photos/id] PATCH error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId, photoId } = await params;

  try {
    // Verify dish ownership
    const [dish] = await db
      .select({ id: dishes.id })
      .from(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
      .limit(1);

    if (!dish) return notFound("Dish");

    await db
      .delete(dishPhotos)
      .where(and(eq(dishPhotos.id, photoId), eq(dishPhotos.dishId, dishId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[dishes/photos/id] DELETE error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
