import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/stripe-subscriptions";

/**
 * Creates a Stripe SetupIntent for Credential-on-File card vaulting.
 * Required for subscription checkout: the mandate confirms recurring charge
 * authorization per Visa/Mastercard stored-credential mandates.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "client") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const [user] = await db
    .select({
      stripeCustomerId: authUser.stripeCustomerId,
      email: authUser.email,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
    })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .limit(1);

  let stripeCustomerId = user?.stripeCustomerId ?? null;
  if (!stripeCustomerId) {
    const name =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      session.user.email;
    stripeCustomerId = await getOrCreateStripeCustomer(
      session.user.email,
      name,
    );
    await db
      .update(authUser)
      .set({ stripeCustomerId })
      .where(eq(authUser.id, session.user.id));
  }

  const stripe = getStripe();
  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    usage: "off_session", // enables future Credential-on-File charges
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}
