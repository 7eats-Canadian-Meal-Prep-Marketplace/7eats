import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { listings } from "@/db/schema";

const VALID_STATUSES = [
  "draft",
  "pending_review",
  "active",
  "archived",
] as const;
type ListingStatus = (typeof VALID_STATUSES)[number];

const createListingSchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    basePrice: z.number().positive(),
    currency: z.string().length(3).optional().default("CAD"),
    coverPhotoUrl: z.url().optional(),
    minOrderQty: z.number().int().min(1).optional().default(1),
    maxOrderQty: z.number().int().optional(),
  })
  .refine((d) => !d.maxOrderQty || d.maxOrderQty >= d.minOrderQty, {
    message: "maxOrderQty must be >= minOrderQty",
    path: ["maxOrderQty"],
  });

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");

  const validStatus =
    statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as ListingStatus)
      : null;

  try {
    const conditions = validStatus
      ? and(eq(listings.cookId, cookId), eq(listings.status, validStatus))
      : eq(listings.cookId, cookId);

    const rows = await db
      .select()
      .from(listings)
      .where(conditions)
      .orderBy(desc(listings.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("[listings]", err);
    return NextResponse.json(
      { error: "Failed to fetch listings." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = createListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  try {
    const { basePrice, ...rest } = parsed.data;
    const [inserted] = await db
      .insert(listings)
      .values({
        cookId,
        ...rest,
        basePrice: String(basePrice),
        status: "active",
      })
      .returning();

    return NextResponse.json(
      { success: true, data: inserted },
      { status: 201 },
    );
  } catch (err) {
    console.error("[listings]", err);
    return NextResponse.json(
      { error: "Failed to create listing." },
      { status: 500 },
    );
  }
}
