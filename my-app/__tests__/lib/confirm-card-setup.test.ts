import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmSavedCardSetup,
  isSetupIntentSaved,
} from "@/lib/stripe/confirm-card-setup";

describe("isSetupIntentSaved", () => {
  it("returns true only for succeeded setup intents", () => {
    expect(isSetupIntentSaved({ status: "succeeded" } as never)).toBe(true);
    expect(isSetupIntentSaved({ status: "processing" } as never)).toBe(false);
    expect(isSetupIntentSaved({ status: "requires_action" } as never)).toBe(
      false,
    );
    expect(isSetupIntentSaved(null)).toBe(false);
  });
});

describe("confirmSavedCardSetup", () => {
  const clientSecret = "seti_test_secret_abc";
  const email = "client@example.com";
  const postalCode = "A1A1A1";
  const returnUrl = "https://example.com/app/settings";

  let elements: { submit: ReturnType<typeof vi.fn> };
  let stripe: {
    confirmSetup: ReturnType<typeof vi.fn>;
    retrieveSetupIntent: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    elements = { submit: vi.fn().mockResolvedValue({ error: undefined }) };
    stripe = {
      confirmSetup: vi.fn(),
      retrieveSetupIntent: vi.fn(),
    };
  });

  it("submits elements then confirms with the client secret", async () => {
    stripe.confirmSetup.mockResolvedValue({
      error: undefined,
      setupIntent: { status: "succeeded" },
    });

    const result = await confirmSavedCardSetup({
      stripe: stripe as never,
      elements: elements as never,
      clientSecret,
      returnUrl,
      email,
      postalCode,
    });

    expect(elements.submit).toHaveBeenCalledOnce();
    expect(stripe.confirmSetup).toHaveBeenCalledWith({
      elements,
      clientSecret,
      redirect: "if_required",
      confirmParams: {
        return_url: returnUrl,
        payment_method_data: {
          billing_details: {
            email,
            address: { postal_code: postalCode },
          },
        },
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns a friendly error when submit fails", async () => {
    elements.submit.mockResolvedValue({
      error: { code: "invalid_number", message: "raw stripe message" },
    });

    const result = await confirmSavedCardSetup({
      stripe: stripe as never,
      elements: elements as never,
      clientSecret,
      returnUrl,
      email,
      postalCode,
    });

    expect(stripe.confirmSetup).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: "The card number looks invalid. Check it and try again.",
    });
  });

  it("falls back to server verification when the SDK omits setupIntent", async () => {
    stripe.confirmSetup.mockResolvedValue({
      error: undefined,
      setupIntent: undefined,
    });
    stripe.retrieveSetupIntent.mockResolvedValue({
      setupIntent: { status: "requires_payment_method" },
    });
    const verifyOnServer = vi.fn().mockResolvedValue(true);

    const result = await confirmSavedCardSetup({
      stripe: stripe as never,
      elements: elements as never,
      clientSecret,
      returnUrl,
      email,
      postalCode,
      verifyOnServer,
    });

    expect(verifyOnServer).toHaveBeenCalledWith(clientSecret);
    expect(result).toEqual({ ok: true });
  });
});
