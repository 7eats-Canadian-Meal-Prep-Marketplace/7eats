import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import {
  clientSubscriptions,
  cookProfiles,
  listingSubscriptionTiers,
  listings,
} from "@/db/schema";
import {
  archiveStripePrice,
  createStripePrice,
} from "@/lib/stripe-subscriptions";

export type Params = {
  params: Promise<{ listingId: string; tierId: string }>;
};

const patchTierSchema = z
  .object({
    price: z.number().positive(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required.",
  });

export async function PATCH(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId, tierId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = patchTierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  try {
    const [listing] = await db
      .select({ id: listings.id, stripeProductId: listings.stripeProductId })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!listing) return notFound("Listing");

    const [tier] = await db
      .select()
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.id, tierId),
          eq(listingSubscriptionTiers.listingId, listingId),
        ),
      )
      .limit(1);

    if (!tier) return notFound("Tier");

    const updateFields: Partial<typeof listingSubscriptionTiers.$inferInsert> =
      {};

    if (parsed.data.isActive !== undefined) {
      updateFields.isActive = parsed.data.isActive;
    }

    if (parsed.data.price !== undefined) {
      const [cook] = await db
        .select({ stripeAccountId: cookProfiles.stripeAccountId })
        .from(cookProfiles)
        .where(eq(cookProfiles.id, cookId))
        .limit(1);

      if (!cook?.stripeAccountId) {
        return NextResponse.json(
          { error: "Stripe account not connected." },
          { status: 400 },
        );
      }

      if (!listing.stripeProductId) {
        return NextResponse.json(
          { error: "Listing has no Stripe product." },
          { status: 400 },
        );
      }

      if (tier.stripePriceId) {
        await archiveStripePrice(cook.stripeAccountId, tier.stripePriceId);
      }

      const newPriceId = await createStripePrice(
        listing.stripeProductId,
        tier.interval,
        Math.round(parsed.data.price * 100),
      );

      updateFields.price = String(parsed.data.price);
      updateFields.stripePriceId = newPriceId;
    }

    const [updated] = await db
      .update(listingSubscriptionTiers)
      .set(updateFields)
      .where(eq(listingSubscriptionTiers.id, tierId))
      .returning();

    // Sync base_price on listing to cheapest active tier
    const allTiers = await db
      .select({ price: listingSubscriptionTiers.price })
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.listingId, listingId),
          eq(listingSubscriptionTiers.isActive, true),
        ),
      );

    if (allTiers.length > 0) {
      const cheapest = Math.min(...allTiers.map((t) => parseFloat(t.price)));
      await db
        .update(listings)
        .set({ basePrice: String(cheapest) })
        .where(eq(listings.id, listingId));
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[tiers/PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update tier." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId, tierId } = await params;

  try {
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!listing) return notFound("Listing");

    const [tier] = await db
      .select()
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.id, tierId),
          eq(listingSubscriptionTiers.listingId, listingId),
        ),
      )
      .limit(1);

    if (!tier) return notFound("Tier");

    const [activeSub] = await db
      .select({ id: clientSubscriptions.id })
      .from(clientSubscriptions)
      .where(
        and(
          eq(clientSubscriptions.tierId, tierId),
          eq(clientSubscriptions.status, "active"),
        ),
      )
      .limit(1);

    if (activeSub) {
      return NextResponse.json(
        { error: "Cannot deactivate a tier with active subscribers." },
        { status: 409 },
      );
    }

    const [cook] = await db
      .select({ stripeAccountId: cookProfiles.stripeAccountId })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (cook?.stripeAccountId && tier.stripePriceId) {
      await archiveStripePrice(cook.stripeAccountId, tier.stripePriceId);
    }

    await db
      .update(listingSubscriptionTiers)
      .set({ isActive: false })
      .where(eq(listingSubscriptionTiers.id, tierId));

    // Sync listing basePrice after tier deactivation
    const remainingTiers = await db
      .select({ price: listingSubscriptionTiers.price })
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.listingId, listingId),
          eq(listingSubscriptionTiers.isActive, true),
        ),
      );

    if (remainingTiers.length > 0) {
      const cheapest = Math.min(
        ...remainingTiers.map((t) => parseFloat(t.price)),
      );
      await db
        .update(listings)
        .set({ basePrice: String(cheapest) })
        .where(eq(listings.id, listingId));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[tiers/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to deactivate tier." },
      { status: 500 },
    );
  }
}
