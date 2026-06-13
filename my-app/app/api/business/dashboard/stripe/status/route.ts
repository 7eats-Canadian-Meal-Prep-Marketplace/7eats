import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { getStripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const [cook] = await db
      .select({ stripeAccountId: cookProfiles.stripeAccountId })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    const stripeAccountId = cook?.stripeAccountId ?? null;

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

    const stripe = getStripe();
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
