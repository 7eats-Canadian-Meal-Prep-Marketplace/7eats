import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { dedupeCustomerCardPaymentMethods } from "@/lib/payment-methods";
import { getStripe } from "@/lib/stripe";
import { setupIntentIdFromClientSecret } from "@/lib/stripe/setup-intent";

/**
 * Confirms a SetupIntent succeeded and belongs to the logged-in customer.
 * Used as a fallback when the client SDK omits setupIntent on confirmSetup.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "client") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    clientSecret?: string;
  };
  if (!body.clientSecret?.includes("_secret_")) {
    return NextResponse.json(
      { error: "Invalid setup session." },
      { status: 400 },
    );
  }

  const [user] = await db
    .select({ stripeCustomerId: authUser.stripeCustomerId })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .limit(1);

  const stripeCustomerId = user?.stripeCustomerId as string | null;
  if (!stripeCustomerId) {
    return NextResponse.json({ succeeded: false, status: "missing_customer" });
  }

  const stripe = getStripe();
  const intent = await stripe.setupIntents.retrieve(
    setupIntentIdFromClientSecret(body.clientSecret),
  );

  const intentCustomerId =
    typeof intent.customer === "string"
      ? intent.customer
      : (intent.customer?.id ?? null);

  if (intentCustomerId !== stripeCustomerId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (intent.status === "succeeded") {
    await dedupeCustomerCardPaymentMethods(stripeCustomerId);
  }

  return NextResponse.json({
    succeeded: intent.status === "succeeded",
    status: intent.status,
  });
}
