import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cookProfiles, listings } from "@/db/schema";
import { haversineKm } from "@/lib/haversine";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const listingId = params.get("listingId");

  if (!listingId || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: "lat, lng, and listingId are required." },
      { status: 400 },
    );
  }

  const [listing] = await db
    .select({ cookId: listings.cookId })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const [cook] = await db
    .select({
      pickupLat: cookProfiles.pickupLat,
      pickupLng: cookProfiles.pickupLng,
      maxDeliveryKm: cookProfiles.maxDeliveryKm,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.id, listing.cookId))
    .limit(1);

  if (!cook?.pickupLat || !cook?.pickupLng) {
    // Cook has no location set — cannot verify range, allow through
    return NextResponse.json({ data: { inRange: true, distanceKm: null } });
  }

  const distanceKm = haversineKm(cook.pickupLat, cook.pickupLng, lat, lng);

  const maxKm = cook.maxDeliveryKm ?? 10;
  const inRange = distanceKm <= maxKm;

  return NextResponse.json({
    data: { inRange, distanceKm: Math.round(distanceKm * 10) / 10 },
  });
}
