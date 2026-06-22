import { and, asc, eq, exists, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles, dishes } from "@/db/schema";
import { loadCookCards } from "@/lib/cooks/load-cards";
import {
  DEFAULT_MAX_DELIVERY_KM,
  DELIVERY_MAX_KM_MAX,
} from "@/lib/delivery-pricing";
import { SEARCH_PICKUP_MAX_KM } from "@/lib/search/config";
import { boundingBox } from "@/lib/search/normalize";

// A cook is reachable by pickup within the discovery cap, or by delivery within
// their own (possibly larger) radius — so the candidate box must cover whichever
// is wider, or a far-but-deliverable cook would be excluded before the exact
// distance check and vanish from browse while still showing in delivery search.
const REACH_BOX_KM = Math.max(SEARCH_PICKUP_MAX_KM, DELIVERY_MAX_KM_MAX);

function parseCoord(value: string | null, min: number, max: number) {
  if (value == null) return null;
  const n = Number.parseFloat(value);
  if (Number.isNaN(n) || n < min || n > max) return null;
  return n;
}

function parseFulfillmentMode(
  value: string | null,
): "pickup" | "delivery" | null {
  if (value === "pickup" || value === "delivery") return value;
  return null;
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const lat = parseCoord(params.get("lat"), -90, 90);
  const lng = parseCoord(params.get("lng"), -180, 180);
  const mode = parseFulfillmentMode(params.get("mode"));
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

    // Reachability gate — mirror /api/search. When mode is omitted, a cook
    // qualifies if reachable by either fulfillment mode (union). Browse and
    // search pass mode so pickup-only kitchens are hidden in delivery mode.
    const reachable = hasGeo
      ? (() => {
          const box = boundingBox(lat, lng, REACH_BOX_KM);
          const pickupReachable = sql`${cookProfiles.offersPickup} = true AND ${distanceExpr} <= ${SEARCH_PICKUP_MAX_KM}`;
          const deliveryReachable = sql`${cookProfiles.delivery} = 'self' AND ${distanceExpr} <= COALESCE(${cookProfiles.maxDeliveryKm}, ${DEFAULT_MAX_DELIVERY_KM})`;
          const modeReachable =
            mode === "pickup"
              ? pickupReachable
              : mode === "delivery"
                ? deliveryReachable
                : or(pickupReachable, deliveryReachable);
          return and(
            sql`${cookProfiles.pickupLat} IS NOT NULL`,
            sql`${cookProfiles.pickupLng} IS NOT NULL`,
            sql`${cookProfiles.pickupLat} BETWEEN ${box.minLat} AND ${box.maxLat}`,
            sql`${cookProfiles.pickupLng} BETWEEN ${box.minLng} AND ${box.maxLng}`,
            modeReachable,
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
