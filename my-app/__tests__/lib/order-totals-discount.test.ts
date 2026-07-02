import { describe, expect, it } from "vitest";
import { computeOrderChargeBreakdown } from "@/lib/orders/totals";

// Taxes are disabled in the test environment (NEXT_PUBLIC_TAX_COLLECTION_ENABLED
// unset), so calcTax returns 0 and these assertions are tax-free.

function brk(
  subtotal: number,
  platformFeePct: number,
  platformDiscount: number,
) {
  return computeOrderChargeBreakdown({
    subtotal,
    deliveryFee: 0,
    taxProvince: "ON",
    platformFeePct,
    platformDiscount,
  });
}

describe("computeOrderChargeBreakdown — full-subsidy platform discount", () => {
  it("no discount: cook gets base minus fee, no subsidy", () => {
    const b = brk(30, 10, 0); // fee = $3
    expect(b.taxAmount).toBe(0);
    expect(b.totalCents).toBe(3000);
    expect(b.applicationFeeCents).toBe(300);
    expect(b.cookPayoutCents).toBe(2700);
    expect(b.subsidyTopUpCents).toBe(0);
  });

  it("discount smaller than fee: funded entirely from the fee, no top-up", () => {
    const b = brk(30, 10, 2); // fee $3, discount $2
    expect(b.totalCents).toBe(2800); // customer pays full discount
    expect(b.applicationFeeCents).toBe(100); // 300 - 200
    expect(b.cookPayoutCents).toBe(2700); // cook still whole
    expect(b.subsidyTopUpCents).toBe(0);
  });

  it("discount equal to fee: fee exactly absorbs it", () => {
    const b = brk(30, 10, 3);
    expect(b.totalCents).toBe(2700);
    expect(b.applicationFeeCents).toBe(0);
    expect(b.cookPayoutCents).toBe(2700);
    expect(b.subsidyTopUpCents).toBe(0);
  });

  it("discount larger than fee: platform tops up the shortfall", () => {
    const b = brk(30, 10, 5); // fee $3, discount $5
    expect(b.totalCents).toBe(2500); // customer pays full $5 off
    expect(b.applicationFeeCents).toBe(0); // floored, never negative
    expect(b.cookPayoutCents).toBe(2700); // cook still whole
    expect(b.subsidyTopUpCents).toBe(200); // platform funds $2 from balance
  });

  it("invariant: cook actually received (charge split + top-up) always equals full payout", () => {
    for (const discount of [0, 1, 3, 5, 10, 25, 30]) {
      const b = brk(30, 10, discount);
      const cookFromCharge = b.totalCents - b.applicationFeeCents;
      expect(cookFromCharge + b.subsidyTopUpCents).toBe(b.cookPayoutCents);
      // Stripe constraints on a destination charge:
      expect(b.applicationFeeCents).toBeGreaterThanOrEqual(0);
      expect(b.applicationFeeCents).toBeLessThanOrEqual(b.totalCents);
    }
  });
});
