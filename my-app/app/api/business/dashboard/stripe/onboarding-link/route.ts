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

export async function POST(req: NextRequest) {
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
    console.error("[dashboard/stripe/onboarding-link]", err);
    return NextResponse.json(
      { error: "Failed to generate onboarding link." },
      { status: 500 },
    );
  }

  if (!stripeAccountId) {
    return NextResponse.json(
      { error: "Stripe account not found." },
      { status: 404 },
    );
  }

  const stripe = getStripe();
  const isDevMode = process.env.NODE_ENV !== "production" || stripe === null;

  if (isDevMode) {
    return NextResponse.json({
      success: true,
      data: {
        url: "https://connect.stripe.com/setup/s/mock_onboarding",
        mock: true,
      },
    });
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appUrl}/dashboard/stripe/refresh`,
      return_url: `${appUrl}/dashboard/stripe/return`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      success: true,
      data: { url: accountLink.url },
    });
  } catch (err) {
    console.error("[dashboard/stripe/onboarding-link]", err);
    return NextResponse.json(
      { error: "Failed to generate onboarding link." },
      { status: 500 },
    );
  }
}
