import { describe, expect, it } from "vitest";
import { formatPaymentMethodBrand } from "@/lib/stripe/browser";

describe("formatPaymentMethodBrand", () => {
  it("title-cases common card brands", () => {
    expect(formatPaymentMethodBrand("visa")).toBe("Visa");
    expect(formatPaymentMethodBrand("mastercard")).toBe("Mastercard");
    expect(formatPaymentMethodBrand("amex")).toBe("Amex");
  });
});
