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

type Params = { params: Promise<{ dishId: string }> };

const postSchema = z
  .object({
    url: z.string().url(),
    isPrimary: z.boolean().optional().default(false),
    sortOrder: z.number().int().optional().default(0),
  })
  .strict();

export async function POST(req: Request, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId } = await params;

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
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const { url, isPrimary, sortOrder } = parsed.data;

    if (isPrimary) {
      // Transaction: clear existing primary, insert new photo as primary
      const photo = await dbPool.transaction(async (tx) => {
        await tx
          .update(dishPhotos)
          .set({ isPrimary: false })
          .where(eq(dishPhotos.dishId, dishId));

        const [inserted] = await tx
          .insert(dishPhotos)
          .values({ dishId, url, isPrimary: true, sortOrder })
          .returning();

        return inserted;
      });

      return NextResponse.json({ success: true, data: photo }, { status: 201 });
    }

    // Simple insert — not primary
    const [photo] = await db
      .insert(dishPhotos)
      .values({ dishId, url, isPrimary: false, sortOrder })
      .returning();

    return NextResponse.json({ success: true, data: photo }, { status: 201 });
  } catch (error) {
    console.error("[dishes/photos] POST error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
