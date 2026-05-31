import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { listingBundles, listings } from "@/db/schema";

type Params = { params: Promise<{ listingId: string; bundleId: string }> };

const patchBundleSchema = z
  .object({
    label: z.string().max(100).nullable(),
    price: z.number().positive(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required.",
  });

export async function PATCH(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId, bundleId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = patchBundleSchema.safeParse(body);
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

    const [bundle] = await db
      .select({ id: listingBundles.id })
      .from(listingBundles)
      .where(
        and(
          eq(listingBundles.id, bundleId),
          eq(listingBundles.listingId, listingId),
        ),
      )
      .limit(1);
    if (!bundle) return notFound("Bundle");

    const updateFields: Partial<typeof listingBundles.$inferInsert> = {};
    if (parsed.data.label !== undefined) updateFields.label = parsed.data.label;
    if (parsed.data.price !== undefined)
      updateFields.price = String(parsed.data.price);
    if (parsed.data.isActive !== undefined)
      updateFields.isActive = parsed.data.isActive;

    const [updated] = await db
      .update(listingBundles)
      .set(updateFields)
      .where(
        and(
          eq(listingBundles.id, bundleId),
          eq(listingBundles.listingId, listingId),
        ),
      )
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[bundles/PATCH]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId, bundleId } = await params;

  try {
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);
    if (!listing) return notFound("Listing");

    const [bundle] = await db
      .select({ id: listingBundles.id })
      .from(listingBundles)
      .where(
        and(
          eq(listingBundles.id, bundleId),
          eq(listingBundles.listingId, listingId),
        ),
      )
      .limit(1);
    if (!bundle) return notFound("Bundle");

    await db
      .delete(listingBundles)
      .where(
        and(
          eq(listingBundles.id, bundleId),
          eq(listingBundles.listingId, listingId),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[bundles/DELETE]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
