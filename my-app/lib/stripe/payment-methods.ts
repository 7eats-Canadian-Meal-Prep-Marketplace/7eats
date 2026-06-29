import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { formatPaymentMethodBrand } from "@/lib/stripe/browser";

export type ListedCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | undefined;
  expYear: number | undefined;
};

/** Stripe issues a new PaymentMethod id each save/checkout; fingerprint groups the same card. */
export function cardPaymentMethodDedupeKey(pm: Stripe.PaymentMethod): string {
  const card = pm.card;
  if (!card) return pm.id;
  if (card.fingerprint) return `fp:${card.fingerprint}`;
  return `legacy:${card.brand}:${card.last4}:${card.exp_month}:${card.exp_year}`;
}

/**
 * Keep the newest PaymentMethod per physical card; detach older duplicates.
 * Checkout (`setup_future_usage`) and Settings (SetupIntent) both attach cards.
 */
export function dedupeCardPaymentMethods(methods: Stripe.PaymentMethod[]): {
  kept: Stripe.PaymentMethod[];
  toDetach: string[];
} {
  const sorted = [...methods].sort((a, b) => b.created - a.created);
  const keptByKey = new Map<string, Stripe.PaymentMethod>();
  const toDetach: string[] = [];

  for (const pm of sorted) {
    const key = cardPaymentMethodDedupeKey(pm);
    if (keptByKey.has(key)) {
      toDetach.push(pm.id);
    } else {
      keptByKey.set(key, pm);
    }
  }

  const kept = [...keptByKey.values()].sort((a, b) => b.created - a.created);
  return { kept, toDetach };
}

export async function dedupeCustomerCardPaymentMethods(
  stripeCustomerId: string,
): Promise<void> {
  const stripe = getStripe();
  const methods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: "card",
    limit: 100,
  });
  const { toDetach } = dedupeCardPaymentMethods(methods.data);
  await Promise.all(
    toDetach.map((id) =>
      stripe.paymentMethods.detach(id).catch((err) => {
        console.error("[payment-methods/dedupe] detach failed", id, err);
      }),
    ),
  );
}

export async function listCustomerCards(
  stripeCustomerId: string,
): Promise<ListedCard[]> {
  const stripe = getStripe();
  await dedupeCustomerCardPaymentMethods(stripeCustomerId);

  const methods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: "card",
    limit: 10,
  });

  const { kept } = dedupeCardPaymentMethods(methods.data);

  return kept.map((pm) => ({
    id: pm.id,
    brand: formatPaymentMethodBrand(pm.card?.brand ?? "card"),
    last4: pm.card?.last4 ?? "••••",
    expMonth: pm.card?.exp_month,
    expYear: pm.card?.exp_year,
  }));
}

/**
 * Creates a Stripe CustomerSession for Payment Element saved-card redisplay.
 *
 * Not used at client checkout anymore — checkout uses a custom card chooser
 * (GET /api/checkout/payment-methods) so saved cards cannot be edited inline.
 * Kept for potential future Stripe surfaces; Settings card management is custom.
 *
 * The redisplay filter MUST include "limited" and "unspecified": cards saved via
 * a PaymentIntent's `setup_future_usage` or via a SetupIntent default to those
 * values, and the Payment Element shows only `allow_redisplay: "always"` cards
 * unless the session opts the others in — otherwise saved cards never appear.
 *
 * @see https://docs.stripe.com/payments/existing-customers
 */
export async function createCheckoutCustomerSession(
  stripeCustomerId: string,
): Promise<string> {
  const stripe = getStripe();
  const customerSession = await stripe.customerSessions.create({
    customer: stripeCustomerId,
    components: {
      payment_element: {
        enabled: true,
        features: {
          payment_method_redisplay: "enabled",
          payment_method_allow_redisplay_filters: [
            "always",
            "limited",
            "unspecified",
          ],
          // Card management lives in Settings, not the checkout form.
          payment_method_remove: "disabled",
          payment_method_save: "disabled",
        },
      },
    },
  });

  if (!customerSession.client_secret) {
    throw new Error("Stripe CustomerSession returned no client_secret");
  }
  return customerSession.client_secret;
}

export async function detachCustomerPaymentMethod(
  stripeCustomerId: string,
  paymentMethodId: string,
): Promise<void> {
  const stripe = getStripe();
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

  if (pm.customer !== stripeCustomerId) {
    throw new Error("FORBIDDEN");
  }

  await stripe.paymentMethods.detach(paymentMethodId);
}
