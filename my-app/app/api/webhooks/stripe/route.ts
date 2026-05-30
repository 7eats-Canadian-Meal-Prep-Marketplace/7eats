import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { cookPayouts, cookProfiles } from "@/db/schema";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.arrayBuffer();
  const buf = Buffer.from(rawBody);

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

  let event: Stripe.Event;

  if (webhookSecret && stripe) {
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json(
        { error: "Webhook signature verification failed." },
        { status: 400 },
      );
    }
    try {
      event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch {
      return NextResponse.json(
        { error: "Webhook signature verification failed." },
        { status: 400 },
      );
    }
  } else {
    event = JSON.parse(buf.toString()) as Stripe.Event;
  }

  try {
    switch (event.type) {
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

      case "account.updated":
        break;

      default:
        break;
    }
  } catch (err) {
    console.error("[webhook/stripe]", err);
    return NextResponse.json(
      { error: "Failed to process webhook event." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
