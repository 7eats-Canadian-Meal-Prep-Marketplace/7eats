import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { listingPromotions, listings } from "@/db/schema";

type Params = { params: Promise<{ listingId: string }> };

const baseFields = {
  minimumQty: z.number().int().min(1).optional().default(1),
  maxUses: z.number().int().min(1).optional(),
  isActive: z.boolean().optional().default(true),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
};

const createPromotionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("percentage_off"),
    value: z.number().min(1).max(100),
    ...baseFields,
  }),
  z.object({
    type: z.literal("fixed_off"),
    value: z.number().positive(),
    ...baseFields,
  }),
]);

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
      .from(listingPromotions)
      .where(eq(listingPromotions.listingId, listingId))
      .orderBy(asc(listingPromotions.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("[promotions]", err);
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

  const parsed = createPromotionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  if (parsed.data.validFrom && parsed.data.validUntil) {
    if (new Date(parsed.data.validUntil) <= new Date(parsed.data.validFrom)) {
      return NextResponse.json(
        { error: "validUntil must be after validFrom." },
        { status: 400 },
      );
    }
  }

  try {
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);
    if (!listing) return notFound("Listing");

    const [inserted] = await db
      .insert(listingPromotions)
      .values({
        listingId,
        type: parsed.data.type,
        value: String(parsed.data.value),
        minimumQty: parsed.data.minimumQty,
        isActive: parsed.data.isActive,
        ...(parsed.data.maxUses !== undefined
          ? { maxUses: parsed.data.maxUses }
          : {}),
        ...(parsed.data.validFrom
          ? { validFrom: new Date(parsed.data.validFrom) }
          : {}),
        ...(parsed.data.validUntil
          ? { validUntil: new Date(parsed.data.validUntil) }
          : {}),
      } as typeof listingPromotions.$inferInsert)
      .returning();

    return NextResponse.json(
      { success: true, data: inserted },
      { status: 201 },
    );
  } catch (err) {
    console.error("[promotions]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
