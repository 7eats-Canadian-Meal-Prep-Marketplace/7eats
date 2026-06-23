import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ customerSessions: { create } }),
}));

import { createCheckoutCustomerSession } from "@/lib/payment-methods";

describe("createCheckoutCustomerSession", () => {
  beforeEach(() => create.mockReset());

  it("enables redisplay of every saved card (always, limited, unspecified)", async () => {
    create.mockResolvedValue({ client_secret: "cuss_test_secret_123" });

    const secret = await createCheckoutCustomerSession("cus_123");

    expect(secret).toBe("cuss_test_secret_123");
    const params = create.mock.calls[0][0];
    expect(params.customer).toBe("cus_123");
    const features = params.components.payment_element.features;
    expect(features.payment_method_redisplay).toBe("enabled");
    // Cards saved via setup_future_usage / SetupIntent default to "limited" /
    // "unspecified"; without these in the filter they would never be shown.
    expect(features.payment_method_allow_redisplay_filters).toEqual(
      expect.arrayContaining(["always", "limited", "unspecified"]),
    );
  });

  it("throws when Stripe returns no client secret", async () => {
    create.mockResolvedValue({ client_secret: null });
    await expect(createCheckoutCustomerSession("cus_x")).rejects.toThrow();
  });
});
