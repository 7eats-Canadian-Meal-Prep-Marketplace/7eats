import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { listingBundles, listings } from "@/db/schema";

type Params = { params: Promise<{ listingId: string }> };

const createBundleSchema = z.object({
  label: z.string().max(100).optional(),
  quantity: z.number().int().min(1),
  price: z.number().positive(),
});

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId } = await params;

  try {
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);
    if (!listing) return notFound("Listing");

    const rows = await db
      .select()
      .from(listingBundles)
      .where(eq(listingBundles.listingId, listingId))
      .orderBy(asc(listingBundles.quantity));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("[bundles/GET]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

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

  const parsed = createBundleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  try {
    const [listing] = await db
      .select({ id: listings.id, type: listings.type })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);
    if (!listing) return notFound("Listing");

    if (listing.type !== "one_time") {
      return NextResponse.json(
        { error: "Bundles can only be added to one-time listings." },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select({ id: listingBundles.id })
      .from(listingBundles)
      .where(
        and(
          eq(listingBundles.listingId, listingId),
          eq(listingBundles.quantity, parsed.data.quantity),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          error: `A bundle for quantity ${parsed.data.quantity} already exists for this listing.`,
        },
        { status: 409 },
      );
    }

    const [inserted] = await db
      .insert(listingBundles)
      .values({
        listingId,
        quantity: parsed.data.quantity,
        price: String(parsed.data.price),
        ...(parsed.data.label !== undefined
          ? { label: parsed.data.label }
          : {}),
      })
      .returning();

    return NextResponse.json(
      { success: true, data: inserted },
      { status: 201 },
    );
  } catch (err) {
    console.error("[bundles/POST]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
