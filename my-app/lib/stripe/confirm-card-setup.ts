import type { SetupIntent, Stripe, StripeElements } from "@stripe/stripe-js";
import {
  formatStripeCardError,
  stripeCardBillingConfirmParams,
} from "@/lib/stripe/card-errors";

export function isSetupIntentSaved(
  intent: SetupIntent | null | undefined,
): boolean {
  return intent?.status === "succeeded";
}

async function resolveSetupIntent(
  stripe: Stripe,
  clientSecret: string,
  initialIntent: SetupIntent | null,
): Promise<SetupIntent | null> {
  if (isSetupIntentSaved(initialIntent)) return initialIntent;
  const retrieved = await stripe.retrieveSetupIntent(clientSecret);
  return retrieved.setupIntent ?? initialIntent;
}

/**
 * Standard save-and-reuse flow: Elements is created with a SetupIntent
 * client secret, then confirmSetup attaches the card to the customer.
 *
 * @see https://docs.stripe.com/payments/save-and-reuse
 */
export async function confirmSavedCardSetup({
  stripe,
  elements,
  clientSecret,
  returnUrl,
  email,
  postalCode,
  verifyOnServer,
}: {
  stripe: Stripe;
  elements: StripeElements;
  clientSecret: string;
  returnUrl: string;
  email: string;
  postalCode: string;
  verifyOnServer?: (clientSecret: string) => Promise<boolean>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: submitError } = await elements.submit();
  if (submitError) {
    return {
      ok: false,
      error: formatStripeCardError(
        submitError,
        "Your card couldn't be saved. Try again.",
      ),
    };
  }

  const { error: confirmError, setupIntent: initialIntent } =
    await stripe.confirmSetup({
      elements,
      clientSecret,
      redirect: "if_required",
      confirmParams: {
        return_url: returnUrl,
        ...stripeCardBillingConfirmParams({ email, postalCode }),
      },
    });

  if (confirmError) {
    // The user-facing message is intentionally generic; log the raw Stripe error
    // in dev so integration issues (e.g. a "never" field not supplied) are visible.
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[confirmSavedCardSetup] confirmSetup failed:",
        confirmError,
      );
    }
    return {
      ok: false,
      error: formatStripeCardError(
        confirmError,
        "Your card couldn't be saved. Try again.",
      ),
    };
  }

  const intent = await resolveSetupIntent(
    stripe,
    clientSecret,
    initialIntent ?? null,
  );

  if (isSetupIntentSaved(intent)) {
    return { ok: true };
  }

  if (intent?.status === "requires_action") {
    return {
      ok: false,
      error: "Your bank needs extra verification. Try again.",
    };
  }

  if (verifyOnServer && (await verifyOnServer(clientSecret))) {
    return { ok: true };
  }

  return {
    ok: false,
    error: "Your card couldn't be saved. Try again.",
  };
}
