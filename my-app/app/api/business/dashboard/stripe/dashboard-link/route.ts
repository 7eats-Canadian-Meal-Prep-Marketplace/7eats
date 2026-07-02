import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

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
    const loginLink = await stripe.accounts.createLoginLink(
      cook.stripeAccountId,
    );

    return NextResponse.json({ success: true, data: { url: loginLink.url } });
  } catch (err) {
    console.error("[dashboard/stripe/dashboard-link]", err);
    return NextResponse.json(
      { error: "Failed to generate dashboard link." },
      { status: 500 },
    );
  }
}
