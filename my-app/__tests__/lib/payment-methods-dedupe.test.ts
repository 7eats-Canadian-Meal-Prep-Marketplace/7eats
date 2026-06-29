import { describe, expect, it } from "vitest";
import {
  cardPaymentMethodDedupeKey,
  dedupeCardPaymentMethods,
} from "@/lib/stripe/payment-methods";

function cardPm(
  id: string,
  created: number,
  fingerprint: string,
  last4 = "4242",
): {
  id: string;
  created: number;
  card: {
    fingerprint: string;
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
} {
  return {
    id,
    created,
    card: {
      fingerprint,
      brand: "visa",
      last4,
      exp_month: 12,
      exp_year: 2030,
    },
  };
}

describe("dedupeCardPaymentMethods", () => {
  it("keeps the newest payment method per card fingerprint", () => {
    const methods = [
      cardPm("pm_old", 100, "fp_same"),
      cardPm("pm_new", 200, "fp_same"),
      cardPm("pm_other", 150, "fp_other"),
    ];

    const { kept, toDetach } = dedupeCardPaymentMethods(methods as never);

    expect(kept.map((pm) => pm.id)).toEqual(["pm_new", "pm_other"]);
    expect(toDetach).toEqual(["pm_old"]);
  });

  it("falls back to brand, last4, and expiry when fingerprint is missing", () => {
    const methods = [
      {
        id: "pm_a",
        created: 100,
        card: {
          brand: "visa",
          last4: "4242",
          exp_month: 12,
          exp_year: 2030,
        },
      },
      {
        id: "pm_b",
        created: 200,
        card: {
          brand: "visa",
          last4: "4242",
          exp_month: 12,
          exp_year: 2030,
        },
      },
    ];

    const { kept, toDetach } = dedupeCardPaymentMethods(methods as never);

    expect(kept.map((pm) => pm.id)).toEqual(["pm_b"]);
    expect(toDetach).toEqual(["pm_a"]);
  });

  it("builds stable dedupe keys from fingerprint", () => {
    const pm = cardPm("pm_1", 1, "abc123");
    expect(cardPaymentMethodDedupeKey(pm as never)).toBe("fp:abc123");
  });
});
