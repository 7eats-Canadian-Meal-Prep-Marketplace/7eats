import { describe, expect, it } from "vitest";
import {
  checkoutNewCardPaymentElementOptions,
  settingsAddCardPaymentElementOptions,
} from "@/lib/stripe/browser";
import { stripeCardBillingConfirmParams } from "@/lib/stripe/card-errors";

/**
 * Stripe rule: any billing field disabled with `"never"` on the Payment Element
 * MUST be supplied in `payment_method_data.billing_details` at confirm time, or
 * `stripe.confirmSetup` / `confirmPayment` is rejected with an IntegrationError
 * (which our UI swallows into a generic "couldn't be saved" message).
 *
 * The only field the confirm path supplies is `email`
 * (via `stripeBillingEmailConfirmParams`). Therefore no billing field other than
 * `email` may be set to `"never"` in any Payment Element options object.
 *
 * @see https://docs.stripe.com/payments/payment-element/control-billing-details-collection
 */
const confirmParams = stripeCardBillingConfirmParams({
  email: "client@example.com",
  postalCode: "A1A1A1",
}) as {
  payment_method_data?: { billing_details?: Record<string, unknown> };
};
const suppliedAtConfirm = new Set(
  Object.keys(confirmParams.payment_method_data?.billing_details ?? {}),
);

function neverFields(options: {
  fields?: { billingDetails?: unknown };
}): string[] {
  const billingDetails = options.fields?.billingDetails;
  if (!billingDetails || typeof billingDetails !== "object") return [];
  return Object.entries(billingDetails as Record<string, unknown>)
    .filter(([, mode]) => mode === "never")
    .map(([field]) => field);
}

describe("Payment Element billing fields stay consistent with confirm params", () => {
  it("supplies email in payment_method_data at confirm time", () => {
    expect(suppliedAtConfirm.has("email")).toBe(true);
  });

  for (const [name, options] of [
    ["settings add-card", settingsAddCardPaymentElementOptions],
    ["checkout new card", checkoutNewCardPaymentElementOptions],
  ] as const) {
    it(`only disables billing fields that are supplied at confirm for the ${name} form`, () => {
      const unsupplied = neverFields(options).filter(
        (field) => !suppliedAtConfirm.has(field),
      );
      expect(unsupplied).toEqual([]);
    });
  }
});
