import { describe, expect, it } from "vitest";
import { calcDeliveryFee } from "@/lib/delivery/fee";

describe("calcDeliveryFee", () => {
  const base = {
    maxDeliveryKm: 10,
    deliveryRatePerKm: "2.00",
    deliveryFlatFee: "3.00",
    freeDeliveryAbove: "50.00",
  };

  it("charges distance rate only (ignores legacy flat fee)", () => {
    const result = calcDeliveryFee(base, 5, 30);
    expect(result.fee).toBe(10); // 2 * 5
    expect(result.isFree).toBe(false);
    expect(result.isOutOfRange).toBe(false);
  });

  it("returns isOutOfRange when distance exceeds max", () => {
    const result = calcDeliveryFee(base, 11, 30);
    expect(result.isOutOfRange).toBe(true);
    expect(result.fee).toBe(0);
  });

  it("returns isFree when subtotal exceeds freeDeliveryAbove", () => {
    const result = calcDeliveryFee(base, 5, 60);
    expect(result.isFree).toBe(true);
    expect(result.fee).toBe(0);
  });

  it("charges correctly when no free threshold set", () => {
    const result = calcDeliveryFee(
      { ...base, freeDeliveryAbove: null },
      3,
      100,
    );
    expect(result.fee).toBe(6); // 2 * 3
    expect(result.isFree).toBe(false);
  });

  it("charges correctly when no max distance set (unlimited range)", () => {
    const result = calcDeliveryFee({ ...base, maxDeliveryKm: null }, 100, 20);
    expect(result.isOutOfRange).toBe(false);
    expect(result.fee).toBe(200); // 2 * 100
  });

  it("handles string numeric fields from DB", () => {
    const result = calcDeliveryFee(
      {
        maxDeliveryKm: 20,
        deliveryRatePerKm: "1.50",
        deliveryFlatFee: "2.50",
        freeDeliveryAbove: null,
      },
      4,
      0,
    );
    expect(result.fee).toBe(6); // 1.5 * 4
  });
});
