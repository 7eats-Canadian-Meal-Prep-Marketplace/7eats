import {
  loadStripe,
  type StripeElementsOptions,
  type StripePaymentElementOptions,
} from "@stripe/stripe-js";

export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

export const stripeElementsAppearance: NonNullable<
  StripeElementsOptions["appearance"]
> = {
  theme: "stripe",
  variables: {
    colorPrimary: "#d64045",
    borderRadius: "8px",
  },
};

export const settingsStripeElementsAppearance: NonNullable<
  StripeElementsOptions["appearance"]
> = {
  theme: "stripe",
  variables: {
    colorPrimary: "#0f0f0f",
    borderRadius: "10px",
    spacingUnit: "3px",
    fontSizeBase: "15px",
  },
  rules: {
    ".Input": {
      border: "1px solid #e5e5e5",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: "1px solid #0f0f0f",
      boxShadow: "0 0 0 1px #0f0f0f",
    },
  },
};

// Settings add-card form. Email is hidden (clients have it on file). Stripe's
// "auto" mode no longer renders a postal code for cards in non-US regions and
// there is no "always", so we hide ONLY the postal code (granular
// address.postalCode) and collect it via a custom field. Both are supplied at
// confirm via stripeCardBillingConfirmParams. NOTE: hiding the *whole* address
// ("address: never") makes Stripe demand a full street address at confirm — the
// granular form only requires the postal code back, which is all we collect.
// https://docs.stripe.com/payments/payment-element/control-billing-details-collection
const loggedInClientBillingFields = {
  email: "never",
  address: { postalCode: "never" },
} as const;

/** Logged-in clients already have email on file — hide Link + billing email prompts. */
export const settingsAddCardPaymentElementOptions: StripePaymentElementOptions =
  {
    paymentMethodOrder: ["card"],
    fields: { billingDetails: loggedInClientBillingFields },
    wallets: { link: "never" },
  };

/** Card vaulting — Elements options when a SetupIntent client secret is known. */
export function settingsAddCardElementsOptions(
  clientSecret: string,
): StripeElementsOptions {
  return {
    clientSecret,
    appearance: settingsStripeElementsAppearance,
  };
}

/** Logged-in checkout when entering a new card (saved to account via PI). */
export const checkoutNewCardPaymentElementOptions: StripePaymentElementOptions =
  {
    paymentMethodOrder: ["card"],
    fields: { billingDetails: loggedInClientBillingFields },
    wallets: { link: "never" },
  };

// Guest checkout — Stripe "auto" billing fields; no confirm-time payment_method_data.
export const checkoutPaymentElementOptions: StripePaymentElementOptions = {
  paymentMethodOrder: ["card"],
  wallets: { link: "never" },
};

export function formatPaymentMethodBrand(brand: string): string {
  const normalized = brand.trim().toLowerCase();
  if (normalized === "amex") return "Amex";
  if (normalized === "diners") return "Diners Club";
  if (normalized === "unionpay") return "UnionPay";
  if (normalized === "jcb") return "JCB";
  if (!normalized) return "Card";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
