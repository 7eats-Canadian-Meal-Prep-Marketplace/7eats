import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser, authUserTable, legalAcceptances } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hashIp } from "@/lib/hash";
import { GUEST_CHECKOUT_DOCS, LEGAL_VERSION } from "@/lib/legal";
import { getOrCreateStripeCustomer } from "@/lib/stripe-subscriptions";

export type ResolveGuestClientInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  headers: Headers;
  ip: string;
};

export type ResolveGuestClientResult =
  | {
      ok: true;
      clientId: string;
      email: string;
      firstName: string;
      lastName: string;
    }
  | { needsLogin: true; email: string };

/**
 * Creates or reuses a shadow guest user row without issuing a session cookie.
 * Real accounts must sign in; existing guest rows are updated and reused.
 */
export async function resolveGuestClient(
  input: ResolveGuestClientInput,
): Promise<ResolveGuestClientResult> {
  const { firstName, lastName, phone, headers, ip } = input;
  const email = input.email.toLowerCase().trim();

  const [existing] = await db
    .select({
      id: authUser.id,
      isGuestAccount: authUser.isGuestAccount,
    })
    .from(authUser)
    .where(eq(authUser.email, email))
    .limit(1);

  if (existing && !existing.isGuestAccount) {
    return { needsLogin: true, email };
  }

  if (existing?.isGuestAccount) {
    await db
      .update(authUserTable)
      .set({
        firstName,
        lastName,
        phone,
        onboardingCompletedAt: new Date(),
      })
      .where(eq(authUser.id, existing.id));

    await recordGuestLegalAcceptance(existing.id, ip, headers);

    return {
      ok: true,
      clientId: existing.id,
      email,
      firstName,
      lastName,
    };
  }

  const tempPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;

  const signUpRes = await auth.api.signUpEmail({
    body: { email, password: tempPassword, name: `${firstName} ${lastName}` },
    headers,
    asResponse: true,
  });

  if (!signUpRes.ok) {
    console.error("[resolveGuestClient] signUpEmail failed:", signUpRes.status);
    throw new Error("GUEST_SIGNUP_FAILED");
  }

  const payload = (await signUpRes.json()) as { user?: { id: string } };
  const userId = payload?.user?.id;
  if (!userId) {
    throw new Error("GUEST_SIGNUP_NO_USER");
  }

  await db
    .update(authUserTable)
    .set({
      role: "client",
      status: "active",
      firstName,
      lastName,
      phone,
      isGuestAccount: true,
      emailVerified: true,
      onboardingCompletedAt: new Date(),
    })
    .where(eq(authUser.id, userId));

  await recordGuestLegalAcceptance(userId, ip, headers);

  return {
    ok: true,
    clientId: userId,
    email,
    firstName,
    lastName,
  };
}

async function recordGuestLegalAcceptance(
  userId: string,
  ip: string,
  headers: Headers,
): Promise<void> {
  try {
    await db.insert(legalAcceptances).values({
      userId,
      context: "guest_checkout",
      version: LEGAL_VERSION,
      documents: [...GUEST_CHECKOUT_DOCS],
      ipHash: ip === "unknown" ? null : hashIp(ip),
      userAgent: headers.get("user-agent"),
    });
  } catch (err) {
    console.error("[resolveGuestClient] legal acceptance failed:", err);
  }
}

export async function ensureStripeCustomer(
  clientId: string,
  email: string,
  displayName: string,
): Promise<string> {
  const [userRow] = await db
    .select({ stripeCustomerId: authUser.stripeCustomerId })
    .from(authUser)
    .where(eq(authUser.id, clientId))
    .limit(1);

  if (userRow?.stripeCustomerId) {
    return userRow.stripeCustomerId;
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(email, displayName);
  await db
    .update(authUserTable)
    .set({ stripeCustomerId })
    .where(eq(authUser.id, clientId));

  return stripeCustomerId;
}
