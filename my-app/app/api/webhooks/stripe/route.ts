import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/db";
import {
  clientSubscriptions,
  cookPayouts,
  cookProfiles,
  dishes,
  listingDishes,
  listingSubscriptionTiers,
  orderDishes,
  orderPayments,
  orders,
  stripeWebhookEvents,
} from "@/db/schema";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const rawBody = await req.arrayBuffer();
  const buf = Buffer.from(rawBody);

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook/stripe] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Webhook signature verification failed." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch {
    return NextResponse.json(
      { error: "Webhook signature verification failed." },
      { status: 400 },
    );
  }

  // Idempotency: record the event id before processing. Stripe retries
  // deliveries, so an event we've already handled must be acknowledged
  // without re-running its side effects (duplicate orders, double payouts).
  if (event.id) {
    let recorded: { id: string } | undefined;
    try {
      [recorded] = await db
        .insert(stripeWebhookEvents)
        .values({ id: event.id, type: event.type })
        .onConflictDoNothing()
        .returning({ id: stripeWebhookEvents.id });
    } catch (err) {
      console.error("[webhook/stripe] idempotency insert failed", err);
      return NextResponse.json(
        { error: "Failed to process webhook event." },
        { status: 500 },
      );
    }

    if (!recorded) {
      return NextResponse.json(
        { received: true, duplicate: true },
        { status: 200 },
      );
    }
  }

  try {
    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        // In Stripe v22, subscription info is under parent.subscription_details
        const subscriptionId =
          invoice.parent?.type === "subscription_details" &&
          invoice.parent.subscription_details?.subscription
            ? typeof invoice.parent.subscription_details.subscription ===
              "string"
              ? invoice.parent.subscription_details.subscription
              : invoice.parent.subscription_details.subscription.id
            : null;

        if (!subscriptionId) break;

        const [sub] = await db
          .select({
            id: clientSubscriptions.id,
            clientId: clientSubscriptions.clientId,
            listingId: clientSubscriptions.listingId,
            tierId: clientSubscriptions.tierId,
            cookId: clientSubscriptions.cookId,
          })
          .from(clientSubscriptions)
          .where(eq(clientSubscriptions.stripeSubscriptionId, subscriptionId))
          .limit(1);

        if (!sub) break;

        const [tier] = await db
          .select({ price: listingSubscriptionTiers.price })
          .from(listingSubscriptionTiers)
          .where(eq(listingSubscriptionTiers.id, sub.tierId))
          .limit(1);

        if (!tier) break;

        const [cook] = await db
          .select({ platformFeePct: cookProfiles.platformFeePct })
          .from(cookProfiles)
          .where(eq(cookProfiles.id, sub.cookId))
          .limit(1);

        if (!cook) break;

        const tierPriceCents = Math.round(Number.parseFloat(tier.price) * 100);
        const totalCents =
          typeof invoice.amount_paid === "number" && invoice.amount_paid > 0
            ? invoice.amount_paid
            : tierPriceCents;
        const unitPrice = (totalCents / 100).toFixed(2);
        const totalPrice = unitPrice;
        const periodEnd = invoice.period_end
          ? new Date(invoice.period_end * 1000)
          : new Date();

        const [order] = await db
          .insert(orders)
          .values({
            clientId: sub.clientId,
            listingId: sub.listingId,
            cookId: sub.cookId,
            subscriptionId: sub.id,
            status: "pending",
            quantity: 1,
            unitPrice,
            totalPrice,
            currency: "CAD",
            pickupAt: periodEnd,
          })
          .onConflictDoNothing()
          .returning();

        if (!order) break;

        // Snapshot the listing's current dishes into order_dishes
        const listingDishRows = await db
          .select({
            dishId: listingDishes.dishId,
            quantity: listingDishes.quantity,
            sortOrder: listingDishes.sortOrder,
            dishName: dishes.name,
          })
          .from(listingDishes)
          .innerJoin(dishes, eq(listingDishes.dishId, dishes.id))
          .where(eq(listingDishes.listingId, sub.listingId));

        if (listingDishRows.length > 0) {
          await db.insert(orderDishes).values(
            listingDishRows.map((d) => ({
              orderId: order.id,
              dishId: d.dishId,
              dishName: d.dishName,
              quantity: d.quantity,
              sortOrder: d.sortOrder,
            })),
          );
        }

        const feePct = Number.parseFloat(cook.platformFeePct);
        const platformFeeCents = Math.round((totalCents * feePct) / 100);
        const cookPayoutCents = totalCents - platformFeeCents;
        const platformFeeAmount = (platformFeeCents / 100).toFixed(2);
        const cookPayoutAmount = (cookPayoutCents / 100).toFixed(2);

        // Extract payment intent ID from the payments list (Stripe v22)
        const defaultPayment = invoice.payments?.data?.find(
          (p) => (p as Stripe.InvoicePayment).is_default,
        ) as Stripe.InvoicePayment | undefined;
        const rawPaymentIntent =
          defaultPayment?.payment?.payment_intent ?? null;
        const paymentIntentId =
          rawPaymentIntent === null
            ? null
            : typeof rawPaymentIntent === "string"
              ? rawPaymentIntent
              : rawPaymentIntent.id;

        // Retrieve charge ID from the PI so we can store it for dispute/refund webhooks
        let stripeChargeId: string | null = null;
        if (paymentIntentId) {
          try {
            const stripe = getStripe();
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
              expand: ["latest_charge"],
            });
            const latestCharge = pi.latest_charge;
            if (latestCharge && typeof latestCharge === "object") {
              stripeChargeId = latestCharge.id;
            }
          } catch {
            // non-fatal — chargeId is best-effort
          }
        }

        await db.insert(orderPayments).values({
          orderId: order.id,
          cookId: sub.cookId,
          clientId: sub.clientId,
          type: "full",
          status: "held",
          totalAmount: totalPrice,
          platformFeePct: cook.platformFeePct,
          platformFeeAmount,
          cookPayoutAmount,
          currency: "CAD",
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId,
          authorizedAt: new Date(),
          heldAt: new Date(),
        });

        // Sync subscription period dates
        await db
          .update(clientSubscriptions)
          .set({
            currentPeriodStart: new Date(invoice.period_start * 1000),
            currentPeriodEnd: periodEnd,
          })
          .where(eq(clientSubscriptions.id, sub.id));

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        const subscriptionId =
          invoice.parent?.type === "subscription_details" &&
          invoice.parent.subscription_details?.subscription
            ? typeof invoice.parent.subscription_details.subscription ===
              "string"
              ? invoice.parent.subscription_details.subscription
              : invoice.parent.subscription_details.subscription.id
            : null;

        if (!subscriptionId) break;

        await db
          .update(clientSubscriptions)
          .set({ status: "past_due" })
          .where(eq(clientSubscriptions.stripeSubscriptionId, subscriptionId));

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await db
          .update(clientSubscriptions)
          .set({ status: "cancelled", cancelledAt: new Date() })
          .where(eq(clientSubscriptions.stripeSubscriptionId, subscription.id));

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        await db
          .update(clientSubscriptions)
          .set({
            status:
              subscription.status === "active"
                ? "active"
                : subscription.status === "past_due"
                  ? "past_due"
                  : subscription.status === "canceled"
                    ? "cancelled"
                    : "paused",
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodStart: new Date(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (subscription as any).current_period_start * 1000,
            ),
            currentPeriodEnd: new Date(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (subscription as any).current_period_end * 1000,
            ),
          })
          .where(eq(clientSubscriptions.stripeSubscriptionId, subscription.id));

        break;
      }

      case "payout.created": {
        const payout = event.data.object as Stripe.Payout;
        const connectedAccountId = event.account;

        if (!connectedAccountId) break;

        const cooks = await db
          .select({ id: cookProfiles.id })
          .from(cookProfiles)
          .where(eq(cookProfiles.stripeAccountId, connectedAccountId))
          .limit(1);

        const cook = cooks[0];
        if (!cook) break;

        await db
          .insert(cookPayouts)
          .values({
            cookId: cook.id,
            stripePayoutId: payout.id,
            amount: (payout.amount / 100).toFixed(2),
            currency: payout.currency.toUpperCase(),
            status: "pending",
            arrivalDate: new Date(payout.arrival_date * 1000),
          })
          .onConflictDoNothing();

        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        await db
          .update(cookPayouts)
          .set({ status: "paid" })
          .where(eq(cookPayouts.stripePayoutId, payout.id));
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        await db
          .update(cookPayouts)
          .set({ status: "failed" })
          .where(eq(cookPayouts.stripePayoutId, payout.id));
        break;
      }

      case "payout.canceled": {
        const payout = event.data.object as Stripe.Payout;
        await db
          .update(cookPayouts)
          .set({ status: "cancelled" })
          .where(eq(cookPayouts.stripePayoutId, payout.id));
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await db
          .update(orderPayments)
          .set({ status: "pending" })
          .where(eq(orderPayments.stripePaymentIntentId, pi.id));
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId =
          typeof dispute.charge === "string"
            ? dispute.charge
            : dispute.charge.id;
        await db
          .update(orderPayments)
          .set({ status: "disputed" })
          .where(eq(orderPayments.stripeChargeId, chargeId));
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await db
          .update(orderPayments)
          .set({ status: "refunded", refundedAt: new Date() })
          .where(eq(orderPayments.stripeChargeId, charge.id));
        break;
      }

      case "account.updated":
        break;

      default:
        break;
    }
  } catch (err) {
    console.error("[webhook/stripe]", err);
    // Roll back the idempotency marker so Stripe's retry can reprocess this
    // event instead of being treated as an already-handled duplicate.
    if (event.id) {
      await db
        .delete(stripeWebhookEvents)
        .where(eq(stripeWebhookEvents.id, event.id))
        .catch(() => {});
    }
    return NextResponse.json(
      { error: "Failed to process webhook event." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
