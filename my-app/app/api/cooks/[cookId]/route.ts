import { and, avg, count, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  authUser,
  cookPickupWindows,
  cookProfiles,
  cookProfileTags,
  orders,
  reviews,
  tags,
} from "@/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cookId: string }> },
) {
  const { cookId } = await params;

  try {
    // Fetch cook profile joined with auth user
    const [row] = await db
      .select({
        id: cookProfiles.id,
        userId: authUser.id,
        displayName: cookProfiles.displayName,
        photoUrl: cookProfiles.photoUrl,
        bannerUrl: cookProfiles.bannerUrl,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        bio: cookProfiles.bio,
        socialLink: cookProfiles.socialLink,
        neighborhood: authUser.neighborhood,
        pickupCity: cookProfiles.pickupCity,
        leadTime: cookProfiles.leadTime,
        offersPickup: cookProfiles.offersPickup,
        delivery: cookProfiles.delivery,
        minOrderQty: cookProfiles.minOrderQty,
        maxOrderQty: cookProfiles.maxOrderQty,
        cancellationAllowed: cookProfiles.cancellationAllowed,
        isVerified: cookProfiles.setupComplete,
        createdAt: cookProfiles.createdAt,
      })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      // Kitchen stays hidden until onboarding is complete — incomplete or
      // inactive cooks 404 even via direct link.
      .where(
        and(
          eq(cookProfiles.id, cookId),
          eq(authUser.status, "active"),
          eq(cookProfiles.setupComplete, true),
        ),
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    // Compute orders completed
    const [{ ordersCompleted }] = await db
      .select({ ordersCompleted: count() })
      .from(orders)
      .where(
        sql`${orders.cookId} = ${cookId} AND ${orders.status} = 'fulfilled'`,
      );

    // Compute rating stats
    const [{ avgRating, reviewCount }] = await db
      .select({
        avgRating: avg(reviews.rating),
        reviewCount: count(),
      })
      .from(reviews)
      .where(
        sql`${reviews.cookId} = ${cookId} AND ${reviews.isVisible} = TRUE`,
      );

    // All profile tags, grouped by category. "cuisine" and "dietary" are
    // explicit; anything else (e.g. niche/specialty) falls into `niches` so it
    // surfaces regardless of the exact category string.
    const tagRows = await db
      .select({ label: tags.label, category: tags.category })
      .from(cookProfileTags)
      .innerJoin(tags, eq(cookProfileTags.tagId, tags.id))
      .where(eq(cookProfileTags.cookProfileId, cookId));
    const cuisineTypes = tagRows
      .filter((t) => t.category === "cuisine")
      .map((t) => t.label);
    const dietaryTags = tagRows
      .filter((t) => t.category === "dietary")
      .map((t) => t.label);
    const niches = tagRows
      .filter((t) => t.category !== "cuisine" && t.category !== "dietary")
      .map((t) => t.label);

    // Pickup & delivery availability windows.
    const windowRows = await db
      .select({
        windowType: cookPickupWindows.windowType,
        dayOfWeek: cookPickupWindows.dayOfWeek,
        fromTime: cookPickupWindows.fromTime,
        toTime: cookPickupWindows.toTime,
      })
      .from(cookPickupWindows)
      .where(eq(cookPickupWindows.cookId, cookId));
    const toWindow = ({
      dayOfWeek,
      fromTime,
      toTime,
    }: (typeof windowRows)[number]) => ({ dayOfWeek, fromTime, toTime });
    const pickupWindows = windowRows
      .filter((w) => w.windowType === "pickup")
      .map(toWindow);
    const deliveryWindows = windowRows
      .filter((w) => w.windowType === "delivery")
      .map(toWindow);

    const name =
      [row.firstName, row.lastName].filter(Boolean).join(" ") || "Unknown Cook";

    const memberSince = row.createdAt
      ? String(new Date(row.createdAt).getFullYear())
      : null;

    const rating = avgRating != null ? parseFloat(String(avgRating)) : null;

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        userId: row.userId,
        name,
        displayName: row.displayName ?? null,
        photoUrl: row.photoUrl ?? null,
        bannerUrl: row.bannerUrl ?? null,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        bio: row.bio ?? null,
        socialLink: row.socialLink ?? null,
        cuisineTypes,
        niches,
        dietaryTags,
        neighborhood: row.neighborhood ?? null,
        pickupCity: row.pickupCity ?? null,
        rating: rating != null ? Math.round(rating * 10) / 10 : null,
        reviewCount: Number(reviewCount),
        yearsExperience: null,
        isVerified: row.isVerified ?? false,
        memberSince,
        ordersCompleted: Number(ordersCompleted),
        leadTime: row.leadTime ?? null,
        offersPickup: row.offersPickup,
        delivery: row.delivery ?? null,
        pickupWindows,
        deliveryWindows,
        minOrderQty: row.minOrderQty,
        maxOrderQty: row.maxOrderQty,
        cancellationAllowed: row.cancellationAllowed,
      },
    });
  } catch (err) {
    console.error("[cooks/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch cook profile." },
      { status: 500 },
    );
  }
}
