import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles, listingSubscriptionTiers, listings } from "@/db/schema";
import {
  createStripePrice,
  getOrCreateStripeProduct,
} from "@/lib/stripe-subscriptions";

export type Params = { params: Promise<{ listingId: string }> };

const createTierSchema = z.object({
  interval: z.enum(["weekly", "biweekly", "monthly"]),
  price: z.number().positive(),
});

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId } = await params;

  try {
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!listing) return notFound("Listing");

    const tiers = await db
      .select()
      .from(listingSubscriptionTiers)
      .where(eq(listingSubscriptionTiers.listingId, listingId))
      .orderBy(listingSubscriptionTiers.interval);

    return NextResponse.json({ success: true, data: tiers });
  } catch (err) {
    console.error("[tiers/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch tiers." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = createTierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { interval, price } = parsed.data;

  try {
    const [listing] = await db
      .select({
        id: listings.id,
        type: listings.type,
        title: listings.title,
        stripeProductId: listings.stripeProductId,
      })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!listing) return notFound("Listing");

    if (listing.type !== "subscription") {
      return NextResponse.json(
        { error: "Tiers can only be added to subscription listings." },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select({ id: listingSubscriptionTiers.id })
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.listingId, listingId),
          eq(listingSubscriptionTiers.interval, interval),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: `A ${interval} tier already exists for this listing.` },
        { status: 409 },
      );
    }

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

    let stripeProductId = listing.stripeProductId;
    if (!stripeProductId) {
      stripeProductId = await getOrCreateStripeProduct(
        cook.stripeAccountId,
        listingId,
        listing.title,
      );
      await db
        .update(listings)
        .set({ stripeProductId })
        .where(eq(listings.id, listingId));
    }

    const priceInCents = Math.round(price * 100);
    const stripePriceId = await createStripePrice(
      cook.stripeAccountId,
      stripeProductId,
      interval,
      priceInCents,
    );

    const [tier] = await db
      .insert(listingSubscriptionTiers)
      .values({ listingId, interval, price: String(price), stripePriceId })
      .returning();

    // Keep base_price as the cheapest active tier for display purposes
    const allTiers = await db
      .select({ price: listingSubscriptionTiers.price })
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.listingId, listingId),
          eq(listingSubscriptionTiers.isActive, true),
        ),
      );

    const cheapest = Math.min(...allTiers.map((t) => parseFloat(t.price)));
    await db
      .update(listings)
      .set({ basePrice: String(cheapest) })
      .where(eq(listings.id, listingId));

    return NextResponse.json({ success: true, data: tier }, { status: 201 });
  } catch (err) {
    console.error("[tiers/POST]", err);
    return NextResponse.json(
      { error: "Failed to create tier." },
      { status: 500 },
    );
  }
}
