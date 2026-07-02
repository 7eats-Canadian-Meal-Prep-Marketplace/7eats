import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { listCustomerCards } from "@/lib/stripe/payment-methods";

/**
 * Returns the logged-in customer's saved Stripe payment methods (cards only).
 * Used on the checkout payment step to offer "pay with saved card".
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "client") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const [user] = await db
    .select({ stripeCustomerId: authUser.stripeCustomerId })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .limit(1);

  if (!user?.stripeCustomerId) {
    return NextResponse.json({ data: [] });
  }

  const data = await listCustomerCards(user.stripeCustomerId as string);

  return NextResponse.json({ data });
}
