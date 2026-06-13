import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  authUser,
  authUserTable,
  clientSubscriptions,
  cookProfiles,
  listingSubscriptionTiers,
  listings,
} from "@/db/schema";
import {
  createStripeSubscription,
  getOrCreateStripeCustomer,
} from "@/lib/stripe-subscriptions";
import {
  forbidden,
  getClientSession,
  notFound,
  unauthorized,
} from "./_lib/client-auth";

const subscribeSchema = z.object({
  listingId: z.uuid(),
  tierId: z.uuid(),
  paymentMethodId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  if (session.user.role !== "client") return forbidden();

  try {
    const subs = await db
      .select({
        id: clientSubscriptions.id,
        status: clientSubscriptions.status,
        cancelAtPeriodEnd: clientSubscriptions.cancelAtPeriodEnd,
        currentPeriodEnd: clientSubscriptions.currentPeriodEnd,
        createdAt: clientSubscriptions.createdAt,
        listing: {
          id: listings.id,
          title: listings.title,
        },
        tier: {
          id: listingSubscriptionTiers.id,
          interval: listingSubscriptionTiers.interval,
          price: listingSubscriptionTiers.price,
        },
        cookDisplayName: cookProfiles.displayName,
      })
      .from(clientSubscriptions)
      .innerJoin(listings, eq(clientSubscriptions.listingId, listings.id))
      .innerJoin(
        listingSubscriptionTiers,
        eq(clientSubscriptions.tierId, listingSubscriptionTiers.id),
      )
      .innerJoin(cookProfiles, eq(clientSubscriptions.cookId, cookProfiles.id))
      .where(eq(clientSubscriptions.clientId, session.user.id))
      .orderBy(desc(clientSubscriptions.createdAt));

    return NextResponse.json({ success: true, data: subs });
  } catch (err) {
    console.error("[subscriptions/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  if (session.user.role !== "client") {
    return forbidden();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { listingId, tierId, paymentMethodId } = parsed.data;

  try {
    // Verify listing is active + subscription type
    const [listing] = await db
      .select({ id: listings.id, cookId: listings.cookId, type: listings.type })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.status, "active")))
      .limit(1);

    if (!listing) return notFound("Listing");
    if (listing.type !== "subscription") {
      return NextResponse.json(
        { error: "This listing does not support subscriptions." },
        { status: 400 },
      );
    }

    // Verify tier is active + belongs to listing
    const [tier] = await db
      .select({
        id: listingSubscriptionTiers.id,
        stripePriceId: listingSubscriptionTiers.stripePriceId,
        interval: listingSubscriptionTiers.interval,
      })
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.id, tierId),
          eq(listingSubscriptionTiers.listingId, listingId),
          eq(listingSubscriptionTiers.isActive, true),
        ),
      )
      .limit(1);

    if (!tier?.stripePriceId) return notFound("Tier");

    // Prevent duplicate active subscriptions
    const [duplicate] = await db
      .select({ id: clientSubscriptions.id })
      .from(clientSubscriptions)
      .where(
        and(
          eq(clientSubscriptions.clientId, session.user.id),
          eq(clientSubscriptions.listingId, listingId),
          eq(clientSubscriptions.status, "active"),
        ),
      )
      .limit(1);

    if (duplicate) {
      return NextResponse.json(
        { error: "You already have an active subscription to this listing." },
        { status: 409 },
      );
    }

    // Load cook's stripe account
    const [cook] = await db
      .select({
        stripeAccountId: cookProfiles.stripeAccountId,
        platformFeePct: cookProfiles.platformFeePct,
      })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, listing.cookId))
      .limit(1);

    if (!cook?.stripeAccountId) {
      return NextResponse.json(
        { error: "Cook Stripe account not connected." },
        { status: 400 },
      );
    }

    // Get or create Stripe Customer for this client
    const [userRow] = await db
      .select({
        stripeCustomerId: authUser.stripeCustomerId,
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        onboardingCompletedAt: authUser.onboardingCompletedAt,
      })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    if (!userRow?.onboardingCompletedAt) {
      return NextResponse.json(
        { error: "Complete onboarding before starting a subscription." },
        { status: 403 },
      );
    }

    let stripeCustomerId = userRow?.stripeCustomerId ?? null;
    if (!stripeCustomerId) {
      const name =
        [userRow?.firstName, userRow?.lastName].filter(Boolean).join(" ") ||
        session.user.email;
      stripeCustomerId = await getOrCreateStripeCustomer(
        session.user.email,
        name,
      );

      await db
        .update(authUserTable)
        .set({ stripeCustomerId })
        .where(eq(authUser.id, session.user.id));
    }

    // Create Stripe Subscription with manual capture
    const stripeSub = await createStripeSubscription({
      customerId: stripeCustomerId,
      priceId: tier.stripePriceId,
      paymentMethodId,
      applicationFeePct: parseFloat(cook.platformFeePct),
      connectedAccountId: cook.stripeAccountId,
    });

    // Persist client_subscriptions row
    const [sub] = await db
      .insert(clientSubscriptions)
      .values({
        clientId: session.user.id,
        listingId,
        tierId,
        cookId: listing.cookId,
        stripeSubscriptionId: stripeSub.id,
        stripeCustomerId,
        currentPeriodStart: new Date(
          stripeSub.items.data[0].current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          stripeSub.items.data[0].current_period_end * 1000,
        ),
      })
      .returning();

    // Note: the first order is created by the invoice.payment_succeeded webhook,
    // not here. Stripe fires that event after subscription creation.

    return NextResponse.json({ success: true, data: sub }, { status: 201 });
  } catch (err) {
    console.error("[subscriptions/POST]", err);
    return NextResponse.json(
      { error: "Failed to create subscription." },
      { status: 500 },
    );
  }
}
