import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { getStripe } from "@/lib/stripe";

// The cook's funds live on their Stripe connected account, not in our DB:
//  - `available` = settled funds Stripe will pay out on the next scheduled run.
//  - `pending`   = funds from recent charges still clearing (not yet payable).
// We surface both so the earnings tab can show "heading to your bank" plus a
// "still settling" hint. Balance is account-scoped, so this works the same for
// our Accounts v2 recipient configs as it does for any connected account.

const CURRENCY = "cad";

type Funds = Array<{ amount: number; currency: string }>;

/** Sum the cents for `currency`, falling back to all entries, and return dollars. */
function sumForCurrency(funds: Funds | undefined, currency: string): number {
  if (!funds?.length) return 0;
  const matched = funds.filter((f) => f.currency === currency);
  const source = matched.length > 0 ? matched : funds;
  const cents = source.reduce((acc, f) => acc + f.amount, 0);
  return cents / 100;
}

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
        data: { hasAccount: false, available: 0, pending: 0, currency: "CAD" },
      });
    }

    const stripe = getStripe();
    // Retrieve the *connected account's* balance via the Stripe-Account header.
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: stripeAccountId },
    );

    return NextResponse.json({
      success: true,
      data: {
        hasAccount: true,
        available: sumForCurrency(balance.available, CURRENCY),
        pending: sumForCurrency(balance.pending, CURRENCY),
        currency: "CAD",
      },
    });
  } catch (err) {
    console.error("[dashboard/earnings/next-payout]", err);
    return NextResponse.json(
      { error: "Failed to fetch next payout." },
      { status: 500 },
    );
  }
}
