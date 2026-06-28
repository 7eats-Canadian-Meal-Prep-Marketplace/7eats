import { and, asc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  authUser,
  cookPickupWindows,
  cookProfiles,
  dishes,
  dishIngredients,
  dishNutrition,
  dishPhotos,
  dishPromotions,
  dishTags,
  tags,
} from "@/db/schema";
import { formatPickupLocation } from "@/lib/address";

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
        bannerUrl: cookProfiles.bannerUrl,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        bio: cookProfiles.bio,
        minOrderQty: cookProfiles.minOrderQty,
        maxOrderQty: cookProfiles.maxOrderQty,
        leadTime: cookProfiles.leadTime,
        offersPickup: cookProfiles.offersPickup,
        delivery: cookProfiles.delivery,
        cancellationAllowed: cookProfiles.cancellationAllowed,
        acceptsSpecialRequests: cookProfiles.acceptsSpecialRequests,
        pickupStreet: cookProfiles.pickupStreet,
        pickupUnit: cookProfiles.pickupUnit,
        pickupCity: cookProfiles.pickupCity,
        pickupProvince: cookProfiles.pickupProvince,
        pickupPostal: cookProfiles.pickupPostal,
      })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      // Kitchen stays hidden until onboarding is complete — incomplete cooks
      // 404 even via direct link, the same as a non-existent cook.
      .where(
        and(
          eq(cookProfiles.id, cookId),
          eq(authUser.status, "active"),
          eq(cookProfiles.setupComplete, true),
        ),
      )
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
        cuisine: dishes.cuisine,
        servingSize: dishes.servingSize,
        isHalal: dishes.isHalal,
        isVegan: dishes.isVegan,
        isVegetarian: dishes.isVegetarian,
        isGlutenFree: dishes.isGlutenFree,
        isDairyFree: dishes.isDairyFree,
        isNutFree: dishes.isNutFree,
        isKosher: dishes.isKosher,
      })
      .from(dishes)
      .where(and(eq(dishes.cookId, cookId), eq(dishes.status, "active")))
      .orderBy(asc(dishes.createdAt));

    const dishIds = dishRows.map((d) => d.id);

    const [photoRows, tagRows, promoRows, ingredientRows, nutritionRows] =
      dishIds.length
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
            db
              .select({
                dishId: dishIngredients.dishId,
                name: dishIngredients.name,
                isAllergen: dishIngredients.isAllergen,
                sortOrder: dishIngredients.sortOrder,
              })
              .from(dishIngredients)
              .where(inArray(dishIngredients.dishId, dishIds))
              .orderBy(asc(dishIngredients.sortOrder)),
            db
              .select({
                dishId: dishNutrition.dishId,
                calories: dishNutrition.calories,
                proteinG: dishNutrition.proteinG,
                carbsG: dishNutrition.carbsG,
                fatG: dishNutrition.fatG,
                fiberG: dishNutrition.fiberG,
                sugarG: dishNutrition.sugarG,
                sodiumMg: dishNutrition.sodiumMg,
              })
              .from(dishNutrition)
              .where(inArray(dishNutrition.dishId, dishIds)),
          ])
        : [[], [], [], [], []];

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

    const ingredientsByDish: Record<
      string,
      { name: string; isAllergen: boolean }[]
    > = {};
    for (const ing of ingredientRows) {
      if (!ingredientsByDish[ing.dishId]) ingredientsByDish[ing.dishId] = [];
      ingredientsByDish[ing.dishId].push({
        name: ing.name,
        isAllergen: ing.isAllergen,
      });
    }

    const nutritionByDish: Record<string, (typeof nutritionRows)[number]> = {};
    for (const n of nutritionRows) nutritionByDish[n.dishId] = n;

    const DIETARY_LABELS: [keyof (typeof dishRows)[number], string][] = [
      ["isHalal", "Halal"],
      ["isVegan", "Vegan"],
      ["isVegetarian", "Vegetarian"],
      ["isGlutenFree", "Gluten-free"],
      ["isDairyFree", "Dairy-free"],
      ["isNutFree", "Nut-free"],
      ["isKosher", "Kosher"],
    ];

    const assembled = dishRows.map((d) => {
      const promo = promoByDish[d.id];
      const n = nutritionByDish[d.id];
      return {
        id: d.id,
        name: d.name,
        description: d.description ?? null,
        price: d.price,
        cuisine: d.cuisine ?? null,
        servingSize: d.servingSize ?? null,
        dietary: DIETARY_LABELS.filter(([key]) => d[key]).map(
          ([, label]) => label,
        ),
        photos: photosByDish[d.id] ?? [],
        tags: tagsByDish[d.id] ?? [],
        ingredients: ingredientsByDish[d.id] ?? [],
        nutrition: n
          ? {
              calories: n.calories,
              proteinG: n.proteinG,
              carbsG: n.carbsG,
              fatG: n.fatG,
              fiberG: n.fiberG,
              sugarG: n.sugarG,
              sodiumMg: n.sodiumMg,
            }
          : null,
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

    const {
      firstName,
      lastName,
      // Raw street fields are composed into a single `pickupLocation` string
      // below so the response never exposes more than the formatted address.
      pickupStreet,
      pickupUnit,
      pickupPostal,
      ...cookRest
    } = cook;
    const cookName = [firstName, lastName].filter(Boolean).join(" ") || null;
    // Shown to the client at checkout for pickup orders. Pickup-only.
    const pickupLocation = cookRest.offersPickup
      ? formatPickupLocation({
          street: pickupStreet,
          unit: pickupUnit,
          city: cookRest.pickupCity,
          province: cookRest.pickupProvince,
          postal: pickupPostal,
        })
      : null;

    return NextResponse.json({
      success: true,
      data: {
        cook: {
          ...cookRest,
          cookName,
          pickupLocation,
          pickupWindows,
          deliveryWindows,
        },
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
