import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { kitchenDisplayName } from "@/lib/cooks/display";
import { loadCookCards } from "@/lib/cooks/load-cards";
import { SUGGEST_LIMIT } from "@/lib/search/config";
import { normalizeQuery } from "@/lib/search/normalize";
import { searchCooks } from "@/lib/search/query";

const querySchema = z.object({
  q: z.string().min(1).max(100),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  mode: z.enum(["pickup", "delivery"]).default("pickup"),
});

export type SuggestKitchen = {
  id: string;
  name: string;
  cuisines: string[];
  photoUrl: string | null;
  distanceKm: number | null;
};

export type SuggestResponse = {
  terms: string[];
  kitchens: SuggestKitchen[];
};

/**
 * Lightweight autocomplete: a few typo-tolerant cuisine/dietary term chips plus
 * a short preview of the top reachable kitchens for the query.
 */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const parsed = querySchema.safeParse({
    q: sp.get("q") ?? "",
    // `?? undefined` so absent coords fail validation instead of coercing to 0.
    lat: sp.get("lat") ?? undefined,
    lng: sp.get("lng") ?? undefined,
    mode: sp.get("mode") ?? "pickup",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "lat, lng and a query are required." },
      { status: 400 },
    );
  }

  const { lat, lng, mode } = parsed.data;
  const q = normalizeQuery(parsed.data.q);
  if (!q) {
    return NextResponse.json({
      success: true,
      data: { terms: [], kitchens: [] } satisfies SuggestResponse,
    });
  }

  try {
    // Term chips from the (small) tag vocabulary — typo tolerant via trigram.
    const termRows = await db.execute(sql`
      SELECT label
      FROM tags
      WHERE category IN ('cuisine', 'niche')
        AND (label ILIKE ${`${q}%`} OR word_similarity(${q}, label) >= 0.4)
      ORDER BY (label ILIKE ${`${q}%`}) DESC, word_similarity(${q}, label) DESC
      LIMIT ${SUGGEST_LIMIT}
    `);
    const terms = ((termRows.rows ?? []) as Array<{ label: string }>).map(
      (r) => r.label,
    );

    // Top reachable kitchens for the query (reuses the ranked search).
    const hits = await searchCooks({ q, lat, lng, mode, limit: 5 });
    const cards = await loadCookCards(
      hits.map((h) => h.cookId),
      { lat, lng },
    );
    const kitchens: SuggestKitchen[] = cards.map((c) => ({
      id: c.id,
      name: kitchenDisplayName(c),
      cuisines: c.cuisines.map((t) => t.label),
      photoUrl: c.photoUrl ?? c.bannerUrl ?? c.representativeDishPhoto,
      distanceKm: c.distanceKm,
    }));

    return NextResponse.json({
      success: true,
      data: { terms, kitchens } satisfies SuggestResponse,
    });
  } catch (err) {
    console.error("[api/search/suggest GET]", err);
    return NextResponse.json(
      { success: false, error: "Suggest failed." },
      { status: 500 },
    );
  }
}
