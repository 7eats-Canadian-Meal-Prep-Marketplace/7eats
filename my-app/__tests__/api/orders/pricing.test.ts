import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  computeLineTotal,
  earliestPickup,
  isRefundEligible,
  LEAD_TIME_DAYS,
  LEAD_TIME_HOURS,
  refundCutoffExclusive,
} from "@/lib/orders/pricing";
import { computeOrderChargeBreakdown } from "@/lib/orders/totals";
import { zonedParts, zonedTimeToUtc } from "@/lib/timezone";

const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  zonedTimeToUtc(year, month, day, hour, minute, 0);

describe("computeOrderChargeBreakdown (tax collection enabled)", () => {
  const prev = process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED = "true";
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED = prev;
  });

  it("includes Ontario HST in total and Stripe application fee", () => {
    const charges = computeOrderChargeBreakdown({
      subtotal: 100,
      deliveryFee: 10,
      taxProvince: "ON",
      platformFeePct: 7.5,
    });

    expect(charges.taxableBase).toBe(110);
    expect(charges.taxAmount).toBe(14.3);
    expect(charges.totalPrice).toBe(124.3);
    expect(charges.totalCents).toBe(12430);
    expect(charges.platformFeeCents).toBe(825);
    expect(charges.taxCents).toBe(1430);
    expect(charges.applicationFeeCents).toBe(2255);
    expect(charges.cookPayoutCents).toBe(10175);
  });

  it("defaults tax province to ON when cook province is missing", () => {
    const charges = computeOrderChargeBreakdown({
      subtotal: 50,
      deliveryFee: 0,
      taxProvince: null,
      platformFeePct: 10,
    });

    expect(charges.taxProvince).toBe("ON");
    expect(charges.taxAmount).toBe(6.5);
    expect(charges.totalPrice).toBe(56.5);
  });

  it("platform fee is on pre-tax subtotal + delivery only", () => {
    const charges = computeOrderChargeBreakdown({
      subtotal: 80,
      deliveryFee: 5,
      taxProvince: "ON",
      platformFeePct: 10,
    });

    expect(charges.platformFeeCents).toBe(850);
    expect(charges.cookPayoutCents).toBe(
      charges.totalCents - charges.applicationFeeCents,
    );
  });
});

describe("computeOrderChargeBreakdown (tax collection disabled)", () => {
  const prev = process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED = "false";
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED = prev;
  });

  it("charges no tax: total = base, application fee = commission only", () => {
    const charges = computeOrderChargeBreakdown({
      subtotal: 100,
      deliveryFee: 10,
      taxProvince: "ON",
      platformFeePct: 7.5,
    });

    expect(charges.taxAmount).toBe(0);
    expect(charges.taxCents).toBe(0);
    expect(charges.totalPrice).toBe(110);
    // Application fee is now just the platform commission (no tax bundled in).
    expect(charges.applicationFeeCents).toBe(825);
    expect(charges.applicationFeeCents).toBe(charges.platformFeeCents);
    // Cook keeps base minus commission.
    expect(charges.cookPayoutCents).toBe(10175);
  });
});

describe("computeLineTotal", () => {
  it("no promo", () => {
    expect(computeLineTotal(10, 2, null)).toEqual({
      discountAmount: 0,
      lineTotal: 20,
    });
  });

  it("percentage_off", () => {
    expect(
      computeLineTotal(10, 2, { type: "percentage_off", value: 50 }),
    ).toEqual({ discountAmount: 10, lineTotal: 10 });
  });

  it("fixed_off applies per unit, not once per line", () => {
    // 4 burgers @ $10 with a $5 fixed_off → $5 off each = $20 off, $20 total.
    expect(computeLineTotal(10, 4, { type: "fixed_off", value: 5 })).toEqual({
      discountAmount: 20,
      lineTotal: 20,
    });
  });

  it("percentage_off applies per unit", () => {
    // 4 burgers @ $10 with 25% off → $2.50 off each = $10 off, $30 total.
    expect(
      computeLineTotal(10, 4, { type: "percentage_off", value: 25 }),
    ).toEqual({ discountAmount: 10, lineTotal: 30 });
  });

  it("fixed_off never goes negative (clamped to unit price)", () => {
    expect(computeLineTotal(5, 1, { type: "fixed_off", value: 999 })).toEqual({
      discountAmount: 5,
      lineTotal: 0,
    });
  });

  it("rounds to cents", () => {
    expect(
      computeLineTotal(9.99, 3, { type: "percentage_off", value: 10 }),
    ).toEqual({ discountAmount: 3, lineTotal: 26.97 });
  });
});

describe("lead time", () => {
  it("maps enum values to hours (legacy cancel windows)", () => {
    expect(LEAD_TIME_HOURS.same_day).toBe(0);
    expect(LEAD_TIME_HOURS["2_days"]).toBe(48);
    expect(LEAD_TIME_HOURS["5_days"]).toBe(120);
  });

  it("maps enum values to calendar days", () => {
    expect(LEAD_TIME_DAYS.same_day).toBe(0);
    expect(LEAD_TIME_DAYS["3_days"]).toBe(3);
  });

  it("computes earliest pickup using local calendar days", () => {
    const now = at(2026, 6, 18, 14, 30); // 2026-06-18 2:30pm Toronto
    const earliest = earliestPickup("1_day", now);
    expect(zonedParts(earliest)).toMatchObject({
      year: 2026,
      month: 6,
      day: 19,
      hour: 0,
    });

    const sameDay = earliestPickup("same_day", now);
    expect(sameDay.getTime()).toBe(now.getTime());
  });

  it("refund cutoff uses calendar days before pickup", () => {
    const pickup = at(2026, 6, 18, 18); // Thu Jun 18 6pm Toronto
    const cutoff = refundCutoffExclusive(pickup, "3_days", "23:59:59");
    expect(cutoff && zonedParts(cutoff)).toMatchObject({
      year: 2026,
      month: 6,
      day: 15, // just after Mon 23:59:59
      hour: 23,
      minute: 59,
      second: 59,
    });

    expect(
      isRefundEligible(pickup, "3_days", true, at(2026, 6, 15, 23), "23:59:59"),
    ).toBe(true);
    expect(
      isRefundEligible(pickup, "3_days", true, at(2026, 6, 16, 0), "23:59:59"),
    ).toBe(false);
  });

  it("refund cutoff honors a 10pm order-by time", () => {
    const pickup = at(2026, 6, 20, 11);
    expect(
      isRefundEligible(
        pickup,
        "2_days",
        true,
        at(2026, 6, 18, 21, 59),
        "22:00:00",
      ),
    ).toBe(true);
    expect(
      isRefundEligible(
        pickup,
        "2_days",
        true,
        at(2026, 6, 18, 22, 1),
        "22:00:00",
      ),
    ).toBe(false);
  });
});
