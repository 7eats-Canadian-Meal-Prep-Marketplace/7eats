import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db, dbPool } from "@/db";
import { dishes, dishPhotos } from "@/db/schema";
import { uploadListingPhoto } from "@/lib/storage/listings";
import {
  DISH_PHOTO_MAX_BYTES,
  isAllowedDishPhotoMime,
  sniffFileType,
} from "@/lib/upload-validation";

type Params = { params: Promise<{ dishId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId } = await params;

  try {
    const [dish] = await db
      .select({ id: dishes.id })
      .from(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
      .limit(1);

    if (!dish) return notFound("Dish");

    const fd = await req.formData();
    const photo = fd.get("photo") as File | null;
    const isPrimary = fd.get("isPrimary") === "true";

    if (!photo || photo.size === 0) {
      return NextResponse.json(
        { error: "Photo is required." },
        { status: 400 },
      );
    }
    if (!isAllowedDishPhotoMime(photo.type)) {
      return NextResponse.json(
        { error: "Photo must be JPEG, PNG, or WebP." },
        { status: 400 },
      );
    }
    if (photo.size > DISH_PHOTO_MAX_BYTES) {
      return NextResponse.json(
        { error: "Photo must be smaller than 10 MB." },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await photo.arrayBuffer());
    const sniffed = sniffFileType(buf);
    if (
      sniffed !== "image/jpeg" &&
      sniffed !== "image/png" &&
      sniffed !== "image/webp"
    ) {
      return NextResponse.json(
        { error: "Photo must be a valid image file." },
        { status: 400 },
      );
    }

    const url = await uploadListingPhoto(dishId, photo.name, buf, sniffed);

    if (isPrimary) {
      const inserted = await dbPool.transaction(async (tx) => {
        await tx
          .update(dishPhotos)
          .set({ isPrimary: false })
          .where(eq(dishPhotos.dishId, dishId));

        const [row] = await tx
          .insert(dishPhotos)
          .values({ dishId, url, isPrimary: true, sortOrder: 0 })
          .returning();

        return row;
      });

      return NextResponse.json(
        { success: true, data: inserted },
        { status: 201 },
      );
    }

    const [inserted] = await db
      .insert(dishPhotos)
      .values({ dishId, url, isPrimary: false, sortOrder: 0 })
      .returning();

    return NextResponse.json(
      { success: true, data: inserted },
      { status: 201 },
    );
  } catch (err) {
    console.error("[dishes/photos/upload]", err);
    return NextResponse.json(
      { error: "Failed to upload photo." },
      { status: 500 },
    );
  }
}
