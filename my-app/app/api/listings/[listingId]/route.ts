import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  authUser,
  cookProfiles,
  dishes,
  listingBundles,
  listingDishes,
  listingPromotions,
  listings,
} from "@/db/schema";

type RouteContext = { params: Promise<{ listingId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { listingId } = await params;

  try {
    // Fetch listing + cook info
    const cookName = sql<string>`COALESCE(${authUser.firstName} || ' ' || ${authUser.lastName}, ${authUser.firstName}, ${authUser.lastName}, '')`;

    const [row] = await db
      .select({
        id: listings.id,
        title: listings.title,
        description: listings.description,
        type: listings.type,
        subscriptionEnabled: listings.subscriptionEnabled,
        basePrice: listings.basePrice,
        currency: listings.currency,
        minOrderQty: listings.minOrderQty,
        maxOrderQty: listings.maxOrderQty,
        coverPhotoUrl: listings.coverPhotoUrl,
        depositEnabled: listings.depositEnabled,
        createdAt: listings.createdAt,
        cookId: cookProfiles.id,
        cookName: cookName,
        cookFirstName: authUser.firstName,
        cookNeighborhood: authUser.neighborhood,
      })
      .from(listings)
      .leftJoin(cookProfiles, eq(listings.cookId, cookProfiles.id))
      .leftJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(and(eq(listings.id, listingId), eq(listings.status, "active")))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    }

    // Fetch dishes
    const dishRows = await db
      .select({
        id: dishes.id,
        name: dishes.name,
        description: dishes.description,
        servingSize: dishes.servingSize,
      })
      .from(listingDishes)
      .leftJoin(dishes, eq(listingDishes.dishId, dishes.id))
      .where(eq(listingDishes.listingId, listingId));

    // Fetch active promotion
    const now = new Date();
    const [promotion] = await db
      .select({
        id: listingPromotions.id,
        type: listingPromotions.type,
        value: listingPromotions.value,
      })
      .from(listingPromotions)
      .where(
        and(
          eq(listingPromotions.listingId, listingId),
          eq(listingPromotions.isActive, true),
          or(
            isNull(listingPromotions.validUntil),
            sql`${listingPromotions.validUntil} > ${now.toISOString()}`,
          ),
        ),
      )
      .limit(1);

    // Fetch active bundles
    const bundleRows = await db
      .select({
        id: listingBundles.id,
        quantity: listingBundles.quantity,
        price: listingBundles.price,
        label: listingBundles.label,
      })
      .from(listingBundles)
      .where(
        and(
          eq(listingBundles.listingId, listingId),
          eq(listingBundles.isActive, true),
        ),
      )
      .orderBy(asc(listingBundles.quantity));

    const data = {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      type: row.type,
      subscriptionEnabled: row.subscriptionEnabled,
      basePrice: Number.parseFloat(row.basePrice),
      currency: row.currency,
      minOrderQty: row.minOrderQty,
      maxOrderQty: row.maxOrderQty ?? null,
      coverPhotoUrl: row.coverPhotoUrl ?? null,
      depositEnabled: row.depositEnabled,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : row.createdAt,
      cook: {
        id: row.cookId ?? "",
        name: row.cookName ?? "",
        firstName: row.cookFirstName ?? null,
        neighborhood: row.cookNeighborhood ?? null,
        rating: null,
        isVerified: false,
      },
      dishes: dishRows
        .filter((d) => d.id !== null)
        .map((d) => ({
          id: d.id as string,
          name: d.name as string,
          description: d.description ?? null,
          price: Number.parseFloat(row.basePrice),
          portionSize: d.servingSize ?? null,
        })),
      promotion: promotion
        ? {
            id: promotion.id,
            type: promotion.type,
            value:
              promotion.value !== null
                ? Number.parseFloat(promotion.value)
                : null,
            badge: buildPromoBadge(
              promotion.type,
              promotion.value !== null
                ? Number.parseFloat(promotion.value)
                : null,
            ),
          }
        : null,
      bundles: bundleRows.map((b) => ({
        id: b.id,
        quantity: b.quantity,
        price: Number.parseFloat(b.price),
        label: b.label ?? null,
      })),
    };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[listings/[listingId]/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch listing." },
      { status: 500 },
    );
  }
}

function buildPromoBadge(type: string, value: number | null): string {
  if (type === "percentage_off" && value !== null) {
    return `${value}% off`;
  }
  if (type === "fixed_off" && value !== null) {
    return `$${value} off`;
  }
  if (type === "buy_x_get_y") {
    return "Buy X Get Y";
  }
  return "Promo";
}
