import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  clientSubscriptions,
  listingSubscriptionTiers,
  listings,
  orders,
} from "@/db/schema";
import { cancelStripeSubscription } from "@/lib/stripe-subscriptions";
import { getClientSession, notFound, unauthorized } from "../_lib/client-auth";

export type Params = { params: Promise<{ subscriptionId: string }> };

const subscriptionIdSchema = z.uuid();

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  const { subscriptionId } = await params;

  if (!subscriptionIdSchema.safeParse(subscriptionId).success) {
    return NextResponse.json(
      { error: "Invalid subscription ID." },
      { status: 400 },
    );
  }

  try {
    const [sub] = await db
      .select({
        id: clientSubscriptions.id,
        status: clientSubscriptions.status,
        cancelAtPeriodEnd: clientSubscriptions.cancelAtPeriodEnd,
        currentPeriodStart: clientSubscriptions.currentPeriodStart,
        currentPeriodEnd: clientSubscriptions.currentPeriodEnd,
        cancelledAt: clientSubscriptions.cancelledAt,
        createdAt: clientSubscriptions.createdAt,
        listing: {
          id: listings.id,
          title: listings.title,
          coverPhotoUrl: listings.coverPhotoUrl,
        },
        tier: {
          id: listingSubscriptionTiers.id,
          interval: listingSubscriptionTiers.interval,
          price: listingSubscriptionTiers.price,
        },
      })
      .from(clientSubscriptions)
      .innerJoin(listings, eq(clientSubscriptions.listingId, listings.id))
      .innerJoin(
        listingSubscriptionTiers,
        eq(clientSubscriptions.tierId, listingSubscriptionTiers.id),
      )
      .where(
        and(
          eq(clientSubscriptions.id, subscriptionId),
          eq(clientSubscriptions.clientId, session.user.id),
        ),
      )
      .limit(1);

    if (!sub) return notFound("Subscription");

    // Attach recent orders for this subscription
    const recentOrders = await db
      .select({
        id: orders.id,
        status: orders.status,
        pickupAt: orders.pickupAt,
        totalPrice: orders.totalPrice,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.subscriptionId, subscriptionId))
      .orderBy(desc(orders.createdAt))
      .limit(5);

    return NextResponse.json({
      success: true,
      data: { ...sub, recentOrders },
    });
  } catch (err) {
    console.error("[subscriptions/GET one]", err);
    return NextResponse.json(
      { error: "Failed to fetch subscription." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  const { subscriptionId } = await params;

  if (!subscriptionIdSchema.safeParse(subscriptionId).success) {
    return NextResponse.json(
      { error: "Invalid subscription ID." },
      { status: 400 },
    );
  }

  // ?immediate=true cancels now; default is cancel at period end
  const immediate = new URL(req.url).searchParams.get("immediate") === "true";

  try {
    const [sub] = await db
      .select({
        id: clientSubscriptions.id,
        clientId: clientSubscriptions.clientId,
        status: clientSubscriptions.status,
        stripeSubscriptionId: clientSubscriptions.stripeSubscriptionId,
        currentPeriodEnd: clientSubscriptions.currentPeriodEnd,
        cancellationNoticeDays: listings.cancellationNoticeDays,
      })
      .from(clientSubscriptions)
      .innerJoin(listings, eq(clientSubscriptions.listingId, listings.id))
      .where(
        and(
          eq(clientSubscriptions.id, subscriptionId),
          eq(clientSubscriptions.clientId, session.user.id),
        ),
      )
      .limit(1);

    if (!sub) return notFound("Subscription");

    if (sub.status === "cancelled") {
      return NextResponse.json(
        { error: "Subscription is already cancelled." },
        { status: 400 },
      );
    }

    if (sub.cancellationNoticeDays !== null && sub.currentPeriodEnd !== null) {
      const deadline = new Date(sub.currentPeriodEnd);
      deadline.setDate(deadline.getDate() - sub.cancellationNoticeDays);
      if (new Date() > deadline) {
        return NextResponse.json(
          {
            error: `Cancellations must be made at least ${sub.cancellationNoticeDays} day${sub.cancellationNoticeDays === 1 ? "" : "s"} before your next billing date.`,
          },
          { status: 422 },
        );
      }
    }

    await cancelStripeSubscription(sub.stripeSubscriptionId, !immediate);

    const updateFields: Partial<typeof clientSubscriptions.$inferInsert> =
      immediate
        ? { status: "cancelled", cancelledAt: new Date() }
        : { cancelAtPeriodEnd: true };

    const [updated] = await db
      .update(clientSubscriptions)
      .set(updateFields)
      .where(
        and(
          eq(clientSubscriptions.id, subscriptionId),
          eq(clientSubscriptions.clientId, session.user.id),
        ),
      )
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[subscriptions/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to cancel subscription." },
      { status: 500 },
    );
  }
}
