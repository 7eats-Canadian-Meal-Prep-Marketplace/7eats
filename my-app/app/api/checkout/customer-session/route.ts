import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ensureStripeCustomer } from "@/lib/guest-client";
import { createCheckoutCustomerSession } from "@/lib/payment-methods";

/**
 * Returns a Stripe CustomerSession client secret (legacy / unused at checkout).
 * Client checkout uses the custom wallet chooser instead of Payment Element
 * saved-card redisplay so cards cannot be edited inline.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "client") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const [user] = await db
    .select({
      email: authUser.email,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
    })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .limit(1);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    session.user.name ||
    session.user.email;

  const stripeCustomerId = await ensureStripeCustomer(
    session.user.id,
    user?.email ?? session.user.email,
    displayName,
  );

  const customerSessionClientSecret =
    await createCheckoutCustomerSession(stripeCustomerId);

  return NextResponse.json({ customerSessionClientSecret });
}
