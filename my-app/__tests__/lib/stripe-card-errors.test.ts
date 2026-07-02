import { describe, expect, it } from "vitest";
import {
  formatStripeCardError,
  stripeCardBillingConfirmParams,
} from "@/lib/stripe/card-errors";

describe("formatStripeCardError", () => {
  it("maps card_declined to a friendly message", () => {
    expect(
      formatStripeCardError({ code: "card_declined", message: "raw" }),
    ).toBe(
      "This card was declined. Try a different card or contact your bank.",
    );
  });

  it("hides Stripe integration messages from users", () => {
    expect(
      formatStripeCardError({
        code: "invalid_request_error",
        message:
          'You specified "never" for fields.billing_details.email when creating the payment Element',
      }),
    ).toBe("Check your card details and try again.");
  });

  it("hides thrown IntegrationError text", () => {
    expect(
      formatStripeCardError(
        new Error(
          "Invalid value for stripe.confirmSetup(): elements should have a mounted Payment Element",
        ),
        "Your card couldn't be saved. Try again.",
      ),
    ).toBe("Your card couldn't be saved. Try again.");
  });
});

describe("stripeCardBillingConfirmParams", () => {
  it("passes trimmed email and postal code", () => {
    expect(
      stripeCardBillingConfirmParams({
        email: "  user@example.com  ",
        postalCode: "  A1A 1A1  ",
      }),
    ).toEqual({
      payment_method_data: {
        billing_details: {
          email: "user@example.com",
          address: { postal_code: "A1A 1A1" },
        },
      },
    });
  });

  it("includes only the fields that are provided", () => {
    expect(
      stripeCardBillingConfirmParams({ email: "user@example.com" }),
    ).toEqual({
      payment_method_data: { billing_details: { email: "user@example.com" } },
    });
    expect(stripeCardBillingConfirmParams({ postalCode: "12345" })).toEqual({
      payment_method_data: {
        billing_details: { address: { postal_code: "12345" } },
      },
    });
  });

  it("returns an empty object when nothing is provided", () => {
    expect(stripeCardBillingConfirmParams({})).toEqual({});
    expect(
      stripeCardBillingConfirmParams({ email: "  ", postalCode: "  " }),
    ).toEqual({});
  });
});
