import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { getCachedStripeAccount } from "@/lib/stripe/account-cache";
import { readStripeConnectAccountStatus } from "@/lib/stripe/connect";

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
        data: readStripeConnectAccountStatus(null),
      });
    }

    const stripe = getStripe();
    const account = await getCachedStripeAccount(stripeAccountId, () =>
      stripe.v2.core.accounts.retrieve(stripeAccountId, {
        include: ["configuration.recipient", "requirements"],
      }),
    );

    return NextResponse.json({
      success: true,
      data: readStripeConnectAccountStatus(account),
    });
  } catch (err) {
    console.error("[dashboard/stripe/status]", err);
    return NextResponse.json(
      { error: "Failed to fetch Stripe status." },
      { status: 500 },
    );
  }
}
