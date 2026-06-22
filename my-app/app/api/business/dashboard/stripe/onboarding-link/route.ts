import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  let returnTo = "/business/settings";
  try {
    const body = await req.json();
    if (
      typeof body?.returnTo === "string" &&
      body.returnTo.startsWith("/") &&
      !body.returnTo.startsWith("//")
    ) {
      returnTo = body.returnTo;
    }
  } catch {
    // No body — use default return path.
  }

  try {
    const [cook] = await db
      .select({ stripeAccountId: cookProfiles.stripeAccountId })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!cook?.stripeAccountId) {
      return NextResponse.json(
        { error: "Stripe account not found." },
        { status: 404 },
      );
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const returnUrl = `${appUrl}${returnTo}`;

    // If the recipient configuration's transfers capability is already active,
    // the cook has onboarded and only needs an update link; otherwise onboard.
    const account = await stripe.v2.core.accounts.retrieve(
      cook.stripeAccountId,
      { include: ["configuration.recipient", "configuration.merchant"] },
    );
    const onboarded =
      account.configuration?.recipient?.capabilities?.stripe_balance
        ?.stripe_transfers?.status === "active";

    // The account_links use_case must list exactly the configurations applied to
    // the account, otherwise Stripe rejects it with
    // `configs_must_match_to_use_account_links`. An express-dashboard recipient
    // account also has the `merchant` configuration applied, so derive the list
    // from what's actually present rather than hardcoding `recipient`.
    const configurations = (["recipient", "merchant"] as const).filter(
      (key) => account.configuration?.[key] != null,
    );
    if (configurations.length === 0) configurations.push("recipient");

    const useCase = onboarded
      ? {
          type: "account_update" as const,
          account_update: {
            configurations,
            refresh_url: returnUrl,
            return_url: returnUrl,
          },
        }
      : {
          type: "account_onboarding" as const,
          account_onboarding: {
            configurations,
            refresh_url: returnUrl,
            return_url: returnUrl,
          },
        };

    const accountLink = await stripe.v2.core.accountLinks.create({
      account: cook.stripeAccountId,
      use_case: useCase,
    });

    return NextResponse.json({ success: true, data: { url: accountLink.url } });
  } catch (err) {
    console.error("[dashboard/stripe/onboarding-link]", err);
    return NextResponse.json(
      { error: "Failed to generate onboarding link." },
      { status: 500 },
    );
  }
}
