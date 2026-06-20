import { and, asc, eq, exists, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles, dishes } from "@/db/schema";
import { loadCookCards } from "@/lib/cooks/load-cards";

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
