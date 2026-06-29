import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cookProfiles, orderPayments } from "@/db/schema";
import { createCookSubsidyTransfer } from "@/lib/stripe/payments";

/**
 * Pay the platform-funded discount top-up to the cook AFTER the full payment has
 * been captured/released.
 *
 * When a platform discount exceeds the destination charge's application fee, the
 * destination charge alone can't pay the cook in full. The shortfall is recorded
 * on the `type: "full"` order_payments row as `platformSubsidyAmount`; this helper
 * sends that amount to the cook from the platform's own balance via a separate
 * Stripe transfer and stamps `stripeTopupTransferId`.
 *
 * Idempotent: a row that already has `stripeTopupTransferId` is a no-op. Best
 * effort: any Stripe failure (e.g. insufficient platform balance) is logged and
 * swallowed so it never breaks the order status transition; the row is left
 * unstamped so it can be retried later.
 */
export async function settleCookSubsidy(orderId: string): Promise<void> {
  const [payment] = await db
    .select({
      id: orderPayments.id,
      platformSubsidyAmount: orderPayments.platformSubsidyAmount,
      stripeTopupTransferId: orderPayments.stripeTopupTransferId,
      cookId: orderPayments.cookId,
    })
    .from(orderPayments)
    .where(
      and(eq(orderPayments.orderId, orderId), eq(orderPayments.type, "full")),
    )
    .limit(1);

  // No full-payment row, no subsidy owed, or already settled — nothing to do.
  if (!payment) return;
  if (payment.stripeTopupTransferId) return;
  const subsidy = Number(payment.platformSubsidyAmount);
  if (
    !payment.platformSubsidyAmount ||
    !Number.isFinite(subsidy) ||
    subsidy <= 0
  ) {
    return;
  }

  const [cook] = await db
    .select({ stripeAccountId: cookProfiles.stripeAccountId })
    .from(cookProfiles)
    .where(eq(cookProfiles.id, payment.cookId))
    .limit(1);

  if (!cook?.stripeAccountId) {
    console.error(
      `[settleCookSubsidy] cook ${payment.cookId} has no connected Stripe account; cannot pay subsidy for order ${orderId} (amount ${subsidy})`,
    );
    return;
  }

  const amountCents = Math.round(subsidy * 100);

  try {
    const transferId = await createCookSubsidyTransfer({
      amountCents,
      connectedAccountId: cook.stripeAccountId,
      orderId,
      idempotencyKey: `subsidy-${orderId}`,
    });
    await db
      .update(orderPayments)
      .set({ stripeTopupTransferId: transferId })
      .where(eq(orderPayments.id, payment.id));
  } catch (err) {
    // Best effort: leave stripeTopupTransferId null so this can be retried.
    // A failure here (e.g. insufficient platform balance) must NOT break the
    // order status transition that triggered settlement.
    console.error(
      `[settleCookSubsidy] failed to transfer subsidy of ${amountCents} cents for order ${orderId}`,
      err,
    );
  }
}
