import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_DELIVERY_KM,
  defaultDeliveryRate,
  defaultMaxDeliveryKm,
  withDeliveryDefaults,
} from "@/lib/delivery-pricing";

describe("delivery defaults", () => {
  it("uses 8 km and $0.50/km when unset", () => {
    expect(defaultMaxDeliveryKm()).toBe(8);
    expect(DEFAULT_MAX_DELIVERY_KM).toBe(8);
    expect(defaultDeliveryRate()).toBe(0.5);
    expect(withDeliveryDefaults({})).toEqual({
      maxDeliveryKm: 8,
      deliveryRatePerKm: 0.5,
      deliveryFlatFee: 0,
    });
  });

  it("preserves explicit values", () => {
    expect(
      withDeliveryDefaults({
        maxDeliveryKm: 12,
        deliveryRatePerKm: 1.25,
      }),
    ).toEqual({
      maxDeliveryKm: 12,
      deliveryRatePerKm: 1.25,
      deliveryFlatFee: 0,
    });
  });
});
