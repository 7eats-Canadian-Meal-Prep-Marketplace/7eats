import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { buildCookStripeProfileDefaults } from "@/lib/stripe/connect";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "cook") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [cook] = await db
    .select({
      id: cookProfiles.id,
      displayName: cookProfiles.displayName,
      stripeAccountId: cookProfiles.stripeAccountId,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);

  if (!cook) {
    return NextResponse.json(
      { error: "Cook profile not found." },
      { status: 404 },
    );
  }

  if (cook.stripeAccountId) {
    return NextResponse.json({ success: true });
  }

  if (!session.user.email) {
    return NextResponse.json(
      { error: "A contact email is required to set up payouts." },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();
    // Accounts v2 recipient configuration: cooks receive transferred funds and
    // payouts (destination charges without on_behalf_of). Express dashboard
    // requires both responsibilities collectors to be `application`.
    const account = await stripe.v2.core.accounts.create({
      dashboard: "express",
      contact_email: session.user.email,
      identity: { country: "CA", entity_type: "individual" },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: { stripe_transfers: { requested: true } },
          },
        },
      },
      defaults: {
        currency: "cad",
        profile: buildCookStripeProfileDefaults({
          cookProfileId: cook.id,
          displayName: cook.displayName,
        }),
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      metadata: { cookUserId: session.user.id },
    });

    await db
      .update(cookProfiles)
      .set({ stripeAccountId: account.id })
      .where(eq(cookProfiles.userId, session.user.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[setup/stripe-connect]", err);
    return NextResponse.json(
      { error: "Failed to create Stripe account." },
      { status: 500 },
    );
  }
}
