import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  let stripeAccountId: string | null = null;

  try {
    const [cook] = await db
      .select({ stripeAccountId: cookProfiles.stripeAccountId })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    stripeAccountId = cook?.stripeAccountId ?? null;
  } catch (err) {
    console.error("[dashboard/stripe/status]", err);
    return NextResponse.json(
      { error: "Failed to fetch Stripe status." },
      { status: 500 },
    );
  }

  const stripe = getStripe();
  const isDevMode = process.env.NODE_ENV !== "production" || stripe === null;

  if (isDevMode) {
    return NextResponse.json({
      success: true,
      data: {
        hasAccount: stripeAccountId !== null,
        chargesEnabled: true,
        payoutsEnabled: true,
        requirementsCount: 0,
        requirements: [],
        mock: true,
      },
    });
  }

  if (!stripeAccountId) {
    return NextResponse.json({
      success: true,
      data: {
        hasAccount: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsCount: 0,
        requirements: [],
      },
    });
  }

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    const requirements = account.requirements?.currently_due ?? [];

    return NextResponse.json({
      success: true,
      data: {
        hasAccount: true,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        requirementsCount: requirements.length,
        requirements,
      },
    });
  } catch (err) {
    console.error("[dashboard/stripe/status]", err);
    return NextResponse.json(
      { error: "Failed to fetch Stripe status." },
      { status: 500 },
    );
  }
}
