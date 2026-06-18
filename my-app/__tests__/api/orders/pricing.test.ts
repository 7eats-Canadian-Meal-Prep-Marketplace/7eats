import { describe, expect, it } from "vitest";
import {
  computeLineTotal,
  earliestPickup,
  isRefundEligible,
  LEAD_TIME_DAYS,
  LEAD_TIME_HOURS,
  refundCutoffExclusive,
} from "@/lib/order-pricing";

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

  it("fixed_off never goes negative", () => {
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
    const now = new Date(2026, 5, 18, 14, 30); // 2026-06-18 2:30pm local
    const earliest = earliestPickup("1_day", now);
    expect(earliest.getFullYear()).toBe(2026);
    expect(earliest.getMonth()).toBe(5);
    expect(earliest.getDate()).toBe(19);
    expect(earliest.getHours()).toBe(0);

    const sameDay = earliestPickup("same_day", now);
    expect(sameDay.getTime()).toBe(now.getTime());
  });

  it("refund cutoff uses calendar days before pickup", () => {
    const pickup = new Date(2026, 5, 18, 18, 0); // Thu Jun 18 6pm
    const cutoff = refundCutoffExclusive(pickup, "3_days");
    expect(cutoff?.getFullYear()).toBe(2026);
    expect(cutoff?.getMonth()).toBe(5);
    expect(cutoff?.getDate()).toBe(16); // Tue 00:00 — through end of Mon

    expect(
      isRefundEligible(pickup, "3_days", true, new Date(2026, 5, 15, 23, 0)),
    ).toBe(true);
    expect(
      isRefundEligible(pickup, "3_days", true, new Date(2026, 5, 16, 0, 0)),
    ).toBe(false);
  });
});
