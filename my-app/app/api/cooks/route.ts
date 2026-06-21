import { and, asc, eq, exists, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles, dishes } from "@/db/schema";
import { loadCookCards } from "@/lib/cooks/load-cards";
import { DEFAULT_MAX_DELIVERY_KM } from "@/lib/delivery-pricing";
import { SEARCH_PICKUP_MAX_KM } from "@/lib/search/config";
import { boundingBox } from "@/lib/search/normalize";

function parseCoord(value: string | null, min: number, max: number) {
  if (value == null) return null;
  const n = Number.parseFloat(value);
  if (Number.isNaN(n) || n < min || n > max) return null;
  return n;
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const lat = parseCoord(params.get("lat"), -90, 90);
  const lng = parseCoord(params.get("lng"), -180, 180);
  const hasGeo = lat != null && lng != null;

  try {
    // Haversine distance for proximity ordering of candidate cooks.
    const distanceExpr = hasGeo
      ? sql<number>`(
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians(${lat})) * cos(radians(${cookProfiles.pickupLat})) *
              cos(radians(${cookProfiles.pickupLng}) - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(${cookProfiles.pickupLat}))
            ))
          )
        )`
      : sql<number | null>`NULL`;

    // Reachability gate — mirror /api/search so a cook shown on browse is never
    // missing from search. Browse has no pickup/delivery toggle, so a cook
    // qualifies if it is reachable by EITHER fulfillment mode (the union of what
    // search could surface). A bounding-box pre-filter (on the wider pickup cap)
    // keeps the candidate scan index-friendly before the exact haversine check.
    const reachable = hasGeo
      ? (() => {
          const box = boundingBox(lat, lng, SEARCH_PICKUP_MAX_KM);
          return and(
            sql`${cookProfiles.pickupLat} IS NOT NULL`,
            sql`${cookProfiles.pickupLng} IS NOT NULL`,
            sql`${cookProfiles.pickupLat} BETWEEN ${box.minLat} AND ${box.maxLat}`,
            sql`${cookProfiles.pickupLng} BETWEEN ${box.minLng} AND ${box.maxLng}`,
            or(
              sql`${cookProfiles.offersPickup} = true AND ${distanceExpr} <= ${SEARCH_PICKUP_MAX_KM}`,
              sql`${cookProfiles.delivery} = 'self' AND ${distanceExpr} <= COALESCE(${cookProfiles.maxDeliveryKm}, ${DEFAULT_MAX_DELIVERY_KM})`,
            ),
          );
        })()
      : undefined;

    // Visible cooks: setup complete, active account, at least one active dish.
    const candidates = await db
      .select({ id: cookProfiles.id })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(
        and(
          eq(cookProfiles.setupComplete, true),
          eq(authUser.status, "active"),
          exists(
            db
              .select({ id: dishes.id })
              .from(dishes)
              .where(
                and(
                  eq(dishes.cookId, cookProfiles.id),
                  eq(dishes.status, "active"),
                ),
              ),
          ),
          reachable,
        ),
      )
      .orderBy(hasGeo ? asc(distanceExpr) : asc(cookProfiles.createdAt))
      .limit(50);

    const data = await loadCookCards(
      candidates.map((c) => c.id),
      { lat, lng },
    );

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api/cooks GET]", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch cooks." },
      { status: 500 },
    );
  }
}
