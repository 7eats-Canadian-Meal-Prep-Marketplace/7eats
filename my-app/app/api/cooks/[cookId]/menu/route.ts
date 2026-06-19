import { and, asc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  authUser,
  cookPickupWindows,
  cookProfiles,
  dishes,
  dishPhotos,
  dishPromotions,
  dishTags,
  tags,
} from "@/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cookId: string }> },
) {
  const { cookId } = await params;

  try {
    const [cook] = await db
      .select({
        id: cookProfiles.id,
        displayName: cookProfiles.displayName,
        photoUrl: cookProfiles.photoUrl,
        bio: cookProfiles.bio,
        minOrderQty: cookProfiles.minOrderQty,
        maxOrderQty: cookProfiles.maxOrderQty,
        leadTime: cookProfiles.leadTime,
        offersPickup: cookProfiles.offersPickup,
        delivery: cookProfiles.delivery,
        cancellationAllowed: cookProfiles.cancellationAllowed,
        pickupCity: cookProfiles.pickupCity,
      })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(and(eq(cookProfiles.id, cookId), eq(authUser.status, "active")))
      .limit(1);

    if (!cook) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    const windowRows = await db
      .select({
        windowType: cookPickupWindows.windowType,
        dayOfWeek: cookPickupWindows.dayOfWeek,
        fromTime: cookPickupWindows.fromTime,
        toTime: cookPickupWindows.toTime,
      })
      .from(cookPickupWindows)
      .where(eq(cookPickupWindows.cookId, cookId));

    const pickupWindows = windowRows
      .filter((w) => w.windowType === "pickup")
      .map(({ dayOfWeek, fromTime, toTime }) => ({
        dayOfWeek,
        fromTime,
        toTime,
      }));
    const deliveryWindows = windowRows
      .filter((w) => w.windowType === "delivery")
      .map(({ dayOfWeek, fromTime, toTime }) => ({
        dayOfWeek,
        fromTime,
        toTime,
      }));

    const dishRows = await db
      .select({
        id: dishes.id,
        name: dishes.name,
        description: dishes.description,
        price: dishes.price,
      })
      .from(dishes)
      .where(and(eq(dishes.cookId, cookId), eq(dishes.status, "active")))
      .orderBy(asc(dishes.createdAt));

    const dishIds = dishRows.map((d) => d.id);

    const [photoRows, tagRows, promoRows] = dishIds.length
      ? await Promise.all([
          db
            .select({
              dishId: dishPhotos.dishId,
              url: dishPhotos.url,
              sortOrder: dishPhotos.sortOrder,
            })
            .from(dishPhotos)
            .where(inArray(dishPhotos.dishId, dishIds)),
          db
            .select({
              dishId: dishTags.dishId,
              slug: tags.slug,
              label: tags.label,
            })
            .from(dishTags)
            .innerJoin(tags, eq(dishTags.tagId, tags.id))
            .where(inArray(dishTags.dishId, dishIds)),
          db
            .select({
              dishId: dishPromotions.dishId,
              id: dishPromotions.id,
              type: dishPromotions.type,
              value: dishPromotions.value,
              validUntil: dishPromotions.validUntil,
              maxUses: dishPromotions.maxUses,
              usesCount: dishPromotions.usesCount,
            })
            .from(dishPromotions)
            .where(
              and(
                inArray(dishPromotions.dishId, dishIds),
                eq(dishPromotions.isActive, true),
              ),
            ),
        ])
      : [[], [], []];

    const photosByDish: Record<string, { url: string; sortOrder: number }[]> =
      {};
    for (const p of photoRows) {
      if (!photosByDish[p.dishId]) photosByDish[p.dishId] = [];
      photosByDish[p.dishId].push({ url: p.url, sortOrder: p.sortOrder });
    }
    for (const list of Object.values(photosByDish)) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    const tagsByDish: Record<string, { slug: string; label: string }[]> = {};
    for (const t of tagRows) {
      if (!tagsByDish[t.dishId]) tagsByDish[t.dishId] = [];
      tagsByDish[t.dishId].push({ slug: t.slug, label: t.label });
    }

    // At most one active promotion per dish (partial unique index guarantees it).
    const promoByDish: Record<string, (typeof promoRows)[number]> = {};
    for (const promo of promoRows) promoByDish[promo.dishId] = promo;

    const assembled = dishRows.map((d) => {
      const promo = promoByDish[d.id];
      return {
        id: d.id,
        name: d.name,
        description: d.description ?? null,
        price: d.price,
        photos: photosByDish[d.id] ?? [],
        tags: tagsByDish[d.id] ?? [],
        promotion: promo
          ? {
              id: promo.id,
              type: promo.type,
              value: promo.value,
              validUntil: promo.validUntil,
              maxUses: promo.maxUses,
              usesCount: promo.usesCount,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        cook: { ...cook, pickupWindows, deliveryWindows },
        dishes: assembled,
      },
    });
  } catch (err) {
    console.error("[cooks/menu]", err);
    return NextResponse.json(
      { error: "Failed to load menu." },
      { status: 500 },
    );
  }
}
