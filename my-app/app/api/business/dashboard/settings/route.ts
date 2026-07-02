import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";

const patchSchema = z.object({
  acceptsSpecialRequests: z.boolean().optional(),
  minOrderQty: z.number().int().min(1).optional(),
  maxOrderQty: z.number().int().min(1).nullable().optional(),
  cancellationAllowed: z.boolean().optional(),
  emailNotificationsNewOrder: z.boolean().optional(),
  emailNotificationsNewReview: z.boolean().optional(),
  smsNotificationsNewOrder: z.boolean().optional(),
});

function pickSettingsFields(row: typeof cookProfiles.$inferSelect) {
  return {
    acceptsSpecialRequests: row.acceptsSpecialRequests,
    minOrderQty: row.minOrderQty,
    maxOrderQty: row.maxOrderQty,
    cancellationAllowed: row.cancellationAllowed,
    emailNotificationsNewOrder: row.emailNotificationsNewOrder,
    emailNotificationsNewReview: row.emailNotificationsNewReview,
    smsNotificationsNewOrder: row.smsNotificationsNewOrder,
  };
}

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const [profile] = await db
      .select()
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: "Cook profile not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: pickSettingsFields(profile),
    });
  } catch (err) {
    console.error("[dashboard/settings GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch settings." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  let body: z.infer<typeof patchSchema>;
  try {
    const raw = await req.json();
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  if (
    body.minOrderQty != null &&
    body.maxOrderQty != null &&
    body.maxOrderQty < body.minOrderQty
  ) {
    return NextResponse.json(
      { error: "Max order quantity must be at least the minimum." },
      { status: 400 },
    );
  }

  try {
    const [updated] = await db
      .update(cookProfiles)
      .set(body)
      .where(eq(cookProfiles.id, cookId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Cook profile not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: pickSettingsFields(updated),
    });
  } catch (err) {
    console.error("[dashboard/settings PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update settings." },
      { status: 500 },
    );
  }
}
