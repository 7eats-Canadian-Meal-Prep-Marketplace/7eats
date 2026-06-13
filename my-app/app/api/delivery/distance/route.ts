import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { calcDeliveryFee } from "@/lib/delivery-fee";
import { getDrivingDistanceKm } from "@/lib/mapbox-directions";

const bodySchema = z.object({
  cookId: z.string().uuid(),
  customerLat: z.number().min(-90).max(90),
  customerLng: z.number().min(-180).max(180),
  orderSubtotal: z.number().min(0).optional().default(0),
});

export async function POST(req: NextRequest) {
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

  const { cookId, customerLat, customerLng, orderSubtotal } = parsed.data;

  try {
    const [cook] = await db
      .select({
        delivery: cookProfiles.delivery,
        pickupLat: cookProfiles.pickupLat,
        pickupLng: cookProfiles.pickupLng,
        maxDeliveryKm: cookProfiles.maxDeliveryKm,
        deliveryRatePerKm: cookProfiles.deliveryRatePerKm,
        deliveryFlatFee: cookProfiles.deliveryFlatFee,
        freeDeliveryAbove: cookProfiles.freeDeliveryAbove,
      })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!cook) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    // If cook doesn't do self-delivery, or has no pickup coordinates — free/zero
    if (
      cook.delivery !== "self" ||
      cook.pickupLat == null ||
      cook.pickupLng == null
    ) {
      return NextResponse.json({
        fee: 0,
        isFree: true,
        isOutOfRange: false,
        distanceKm: 0,
      });
    }

    const distanceKm = await getDrivingDistanceKm(
      cook.pickupLat,
      cook.pickupLng,
      customerLat,
      customerLng,
    );

    const result = calcDeliveryFee(
      {
        maxDeliveryKm: cook.maxDeliveryKm,
        deliveryRatePerKm: cook.deliveryRatePerKm,
        deliveryFlatFee: cook.deliveryFlatFee,
        freeDeliveryAbove: cook.freeDeliveryAbove,
      },
      distanceKm,
      orderSubtotal,
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[delivery/distance/POST]", err);
    return NextResponse.json(
      { error: "Failed to calculate delivery distance." },
      { status: 500 },
    );
  }
}
