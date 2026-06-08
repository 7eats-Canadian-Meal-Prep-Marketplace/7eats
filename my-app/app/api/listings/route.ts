import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles, listings } from "@/db/schema";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;

  const q = params.get("q")?.trim() ?? "";

  const rawLimit = Number.parseInt(params.get("limit") ?? "50", 10);
  const limit = Number.isNaN(rawLimit)
    ? 50
    : Math.min(100, Math.max(1, rawLimit));

  const rawOffset = Number.parseInt(params.get("offset") ?? "0", 10);
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset);

  try {
    const cookName = sql<string>`COALESCE(${authUser.firstName} || ' ' || ${authUser.lastName}, ${authUser.firstName}, ${authUser.lastName}, '')`;

    const baseWhere = q
      ? and(
          eq(listings.status, "active"),
          or(
            ilike(listings.title, `%${q}%`),
            ilike(listings.description, `%${q}%`),
            ilike(authUser.firstName, `%${q}%`),
            ilike(authUser.lastName, `%${q}%`),
          ),
        )
      : eq(listings.status, "active");

    const [{ total }] = await db
      .select({ total: count() })
      .from(listings)
      .leftJoin(cookProfiles, eq(listings.cookId, cookProfiles.id))
      .leftJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(baseWhere);

    const rows = await db
      .select({
        id: listings.id,
        title: listings.title,
        description: listings.description,
        cookId: listings.cookId,
        cookName: cookName,
        cookFirstName: authUser.firstName,
        basePrice: listings.basePrice,
        type: listings.type,
        subscriptionEnabled: listings.subscriptionEnabled,
        coverPhotoUrl: listings.coverPhotoUrl,
        minOrderQty: listings.minOrderQty,
        maxOrderQty: listings.maxOrderQty,
        createdAt: listings.createdAt,
      })
      .from(listings)
      .leftJoin(cookProfiles, eq(listings.cookId, cookProfiles.id))
      .leftJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(baseWhere)
      .orderBy(desc(listings.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      cookId: r.cookId,
      cookName: r.cookName ?? "",
      cookFirstName: r.cookFirstName ?? null,
      priceFrom: Number.parseFloat(r.basePrice),
      type: r.type,
      subscriptionEnabled: r.subscriptionEnabled,
      coverPhotoUrl: r.coverPhotoUrl ?? null,
      minOrderQty: r.minOrderQty,
      maxOrderQty: r.maxOrderQty ?? null,
      createdAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: { total, limit, offset },
    });
  } catch (err) {
    console.error("[listings/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch listings." },
      { status: 500 },
    );
  }
}
