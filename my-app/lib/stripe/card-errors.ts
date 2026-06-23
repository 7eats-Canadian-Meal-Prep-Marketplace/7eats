import type { StripeError } from "@stripe/stripe-js";

const STRIPE_TECHNICAL_PATTERNS = [
  /confirmParams/i,
  /fields\.billing/i,
  /payment Element/i,
  /IntegrationError/i,
  /client_secret/i,
  /setup_intent/i,
  /payment_intent/i,
  /payment_method_data/i,
  /stripe\.confirm/i,
];

function isStripeTechnicalMessage(message: string): boolean {
  return STRIPE_TECHNICAL_PATTERNS.some((pattern) => pattern.test(message));
}

/** User-safe card/payment errors — never expose raw Stripe integration messages. */
export function formatStripeCardError(
  error:
    | Pick<StripeError, "code" | "message">
    | Error
    | string
    | null
    | undefined,
  fallback = "Check your card details and try again.",
): string {
  if (!error) return fallback;

  const message =
    typeof error === "string"
      ? error
      : "message" in error
        ? (error.message ?? "")
        : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;

  switch (code) {
    case "card_declined":
      return "This card was declined. Try a different card or contact your bank.";
    case "expired_card":
      return "This card has expired. Check the expiry date and try again.";
    case "incorrect_cvc":
      return "The security code doesn't match this card. Check the CVC and try again.";
    case "incorrect_number":
    case "invalid_number":
      return "The card number looks invalid. Check it and try again.";
    case "invalid_expiry_year":
    case "invalid_expiry_month":
      return "The expiry date looks invalid. Check the month and year.";
    case "processing_error":
      return "We couldn't verify this card right now. Try again in a moment.";
    case "authentication_required":
      return "Your bank needs extra verification. Try again or use a different card.";
    default:
      break;
  }

  if (!message || isStripeTechnicalMessage(message)) {
    return fallback;
  }

  return fallback;
}

/**
 * Builds the `confirmParams.payment_method_data` for a new card when the Payment
 * Element is told not to collect these fields (`fields.billingDetails` set to
 * "never"): every "never" field must be supplied here at confirm time.
 *
 * Postal code is collected from a custom field because Stripe's "auto" mode no
 * longer renders it for cards in non-US regions. Only the postal code is sent —
 * the Element hides just `address.postalCode`, so that is the only address field
 * Stripe requires back (country stays auto, avoiding a confirm-time conflict).
 */
export function stripeCardBillingConfirmParams(params: {
  email?: string | null;
  postalCode?: string | null;
}) {
  const email = params.email?.trim();
  const postalCode = params.postalCode?.trim();

  const billingDetails: {
    email?: string;
    address?: { postal_code: string };
  } = {};
  if (email) billingDetails.email = email;
  if (postalCode) {
    billingDetails.address = { postal_code: postalCode };
  }

  if (!billingDetails.email && !billingDetails.address) return {};
  return { payment_method_data: { billing_details: billingDetails } };
}
