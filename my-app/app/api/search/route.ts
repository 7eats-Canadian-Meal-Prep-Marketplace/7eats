import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadCookCards } from "@/lib/cooks/load-cards";
import { SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT } from "@/lib/search/config";
import { normalizeQuery } from "@/lib/search/normalize";
import { searchCooks } from "@/lib/search/query";

const querySchema = z.object({
  q: z.string().min(1).max(100),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  mode: z.enum(["pickup", "delivery"]).default("pickup"),
  limit: z.coerce.number().int().min(1).max(SEARCH_MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const parsed = querySchema.safeParse({
    q: sp.get("q") ?? "",
    // `?? undefined` so absent coords fail validation instead of coercing to 0.
    lat: sp.get("lat") ?? undefined,
    lng: sp.get("lng") ?? undefined,
    mode: sp.get("mode") ?? "pickup",
    limit: sp.get("limit") ?? undefined,
    offset: sp.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "lat, lng and a non-empty query are required." },
      { status: 400 },
    );
  }

  const { lat, lng, mode } = parsed.data;
  const q = normalizeQuery(parsed.data.q);
  if (!q) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const hits = await searchCooks({
      q,
      lat,
      lng,
      mode,
      limit: parsed.data.limit ?? SEARCH_DEFAULT_LIMIT,
      offset: parsed.data.offset ?? 0,
    });

    const data = await loadCookCards(
      hits.map((h) => h.cookId),
      { lat, lng },
    );

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[api/search GET]", err);
    return NextResponse.json(
      { success: false, error: "Search failed." },
      { status: 500 },
    );
  }
}
