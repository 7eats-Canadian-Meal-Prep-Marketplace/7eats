import { getStripe } from "@/lib/stripe";

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
