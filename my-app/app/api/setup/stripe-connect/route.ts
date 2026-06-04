import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "cook") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [cook] = await db
    .select({ stripeAccountId: cookProfiles.stripeAccountId })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);

  if (cook?.stripeAccountId) {
    return NextResponse.json({ success: true });
  }

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.create({
      type: "express",
      country: "CA",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
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
