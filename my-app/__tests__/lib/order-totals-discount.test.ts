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

  it("discount smaller than the discounted total: fee stays whole, subsidy equals the full discount", () => {
    const b = brk(30, 10, 2); // fee $3, discount $2
    expect(b.totalCents).toBe(2800); // customer pays the discounted total
    expect(b.applicationFeeCents).toBe(300); // full fee taken from the charge
    expect(b.cookPayoutCents).toBe(2700); // cook still whole
    expect(b.subsidyTopUpCents).toBe(200); // 7eats sends the full $2 discount
  });

  it("discount equal to fee: fee still taken whole, subsidy still the full discount", () => {
    const b = brk(30, 10, 3);
    expect(b.totalCents).toBe(2700);
    expect(b.applicationFeeCents).toBe(300);
    expect(b.cookPayoutCents).toBe(2700);
    expect(b.subsidyTopUpCents).toBe(300);
  });

  it("discount larger than fee: subsidy is still exactly the discount amount", () => {
    const b = brk(30, 10, 5); // fee $3, discount $5
    expect(b.totalCents).toBe(2500); // customer pays full $5 off
    expect(b.applicationFeeCents).toBe(300); // fee unaffected by the discount
    expect(b.cookPayoutCents).toBe(2700); // cook still whole
    expect(b.subsidyTopUpCents).toBe(500); // 7eats sends the full $5 discount
  });

  it("discount so large the fee can't fit in the charge: subsidy absorbs the shortfall", () => {
    const b = brk(30, 10, 29); // fee $3, discounted total only $0.01
    expect(b.totalCents).toBe(100);
    expect(b.applicationFeeCents).toBe(100); // capped at the tiny charge amount
    expect(b.cookPayoutCents).toBe(2700); // cook still whole
    // discount ($29) minus the $2 of fee that couldn't be taken from the $0.01
    // charge (that $2 comes out of the subsidy instead)
    expect(b.subsidyTopUpCents).toBe(2900 - 200);
  });

  it("invariant: cook actually received (charge split + top-up) always equals full payout", () => {
    for (const discount of [0, 1, 3, 5, 10, 25, 29, 30]) {
      const b = brk(30, 10, discount);
      const cookFromCharge = b.totalCents - b.applicationFeeCents;
      expect(cookFromCharge + b.subsidyTopUpCents).toBe(b.cookPayoutCents);
      // Stripe constraints on a destination charge:
      expect(b.applicationFeeCents).toBeGreaterThanOrEqual(0);
      expect(b.applicationFeeCents).toBeLessThanOrEqual(b.totalCents);
    }
  });
});
