import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import {
  DELIVERY_MAX_KM_MAX,
  DELIVERY_MAX_KM_MIN,
  DELIVERY_RATE_MAX,
  DELIVERY_RATE_MIN,
  FREE_DELIVERY_ABOVE_MAX,
} from "@/lib/delivery-pricing";
import { rebuildCookSearchIndexSafe } from "@/lib/search/index-builder";

const PROFILE_FIELDS = {
  id: cookProfiles.id,
  displayName: cookProfiles.displayName,
  bio: cookProfiles.bio,
  photoUrl: cookProfiles.photoUrl,
  bannerUrl: cookProfiles.bannerUrl,
  socialLink: cookProfiles.socialLink,
  pickupStreet: cookProfiles.pickupStreet,
  pickupUnit: cookProfiles.pickupUnit,
  pickupCity: cookProfiles.pickupCity,
  pickupProvince: cookProfiles.pickupProvince,
  pickupPostal: cookProfiles.pickupPostal,
  pickupLat: cookProfiles.pickupLat,
  pickupLng: cookProfiles.pickupLng,
  pickupPlaceId: cookProfiles.pickupPlaceId,
  leadTime: cookProfiles.leadTime,
  delivery: cookProfiles.delivery,
  acceptsSpecialRequests: cookProfiles.acceptsSpecialRequests,
  platformFeePct: cookProfiles.platformFeePct,
  lateCancelFeeEnabled: cookProfiles.lateCancelFeeEnabled,
  lateCancelFeeType: cookProfiles.lateCancelFeeType,
  lateCancelFeeValue: cookProfiles.lateCancelFeeValue,
  lateCancelWindowHours: cookProfiles.lateCancelWindowHours,
  maxDeliveryKm: cookProfiles.maxDeliveryKm,
  deliveryRatePerKm: cookProfiles.deliveryRatePerKm,
  deliveryFlatFee: cookProfiles.deliveryFlatFee,
  freeDeliveryAbove: cookProfiles.freeDeliveryAbove,
  setupComplete: cookProfiles.setupComplete,
  createdAt: cookProfiles.createdAt,
  updatedAt: cookProfiles.updatedAt,
} as const;

const bodySchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  photoUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  socialLink: z.string().url().optional().nullable(),
  pickupStreet: z.string().min(1).max(200).optional(),
  pickupUnit: z.string().max(50).optional().nullable(),
  pickupCity: z.string().min(1).max(100).optional(),
  pickupProvince: z.string().length(2).optional(),
  pickupPostal: z.string().min(3).max(10).optional(),
  pickupLat: z.number().optional().nullable(),
  pickupLng: z.number().optional().nullable(),
  pickupPlaceId: z.string().optional().nullable(),
  leadTime: z
    .enum(["same_day", "1_day", "2_days", "3_days", "4_days", "5_days"])
    .optional(),
  delivery: z.enum(["none", "self"]).optional(),
  acceptsSpecialRequests: z.boolean().optional(),
  lateCancelFeeEnabled: z.boolean().optional(),
  lateCancelFeeType: z.enum(["flat", "percentage"]).optional().nullable(),
  lateCancelFeeValue: z.string().optional().nullable(),
  lateCancelWindowHours: z.number().int().min(1).optional(),
  maxDeliveryKm: z
    .number()
    .int()
    .min(DELIVERY_MAX_KM_MIN)
    .max(DELIVERY_MAX_KM_MAX)
    .nullable()
    .optional(),
  deliveryRatePerKm: z
    .number()
    .min(DELIVERY_RATE_MIN)
    .max(DELIVERY_RATE_MAX)
    .nullable()
    .optional(),
  deliveryFlatFee: z.number().min(0).max(0).nullable().optional(),
  freeDeliveryAbove: z
    .number()
    .min(0)
    .max(FREE_DELIVERY_ABOVE_MAX)
    .nullable()
    .optional(),
});

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const [profile] = await db
      .select(PROFILE_FIELDS)
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!profile) return notFound("Profile");

    return NextResponse.json({ success: true, data: profile });
  } catch (err) {
    console.error("[business/profile GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch profile." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const updates = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );

  if (updates.delivery === "self" || updates.deliveryRatePerKm !== undefined) {
    updates.deliveryFlatFee = 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  try {
    const [updated] = await db
      .update(cookProfiles)
      .set(updates)
      .where(eq(cookProfiles.id, cookId))
      .returning(PROFILE_FIELDS);

    // Name, bio, pickup geo and delivery settings all feed search.
    rebuildCookSearchIndexSafe(cookId);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[business/profile PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update profile." },
      { status: 500 },
    );
  }
}
