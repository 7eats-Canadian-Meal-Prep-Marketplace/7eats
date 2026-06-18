import { describe, expect, it } from "vitest";
import {
  computeLineTotal,
  earliestPickup,
  LEAD_TIME_HOURS,
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
  it("maps enum values to hours", () => {
    expect(LEAD_TIME_HOURS.same_day).toBe(0);
    expect(LEAD_TIME_HOURS["2_days"]).toBe(48);
    expect(LEAD_TIME_HOURS["5_days"]).toBe(120);
  });

  it("computes earliest pickup from now", () => {
    const now = new Date("2026-06-18T00:00:00.000Z");
    expect(earliestPickup("1_day", now).toISOString()).toBe(
      "2026-06-19T00:00:00.000Z",
    );
    expect(earliestPickup("same_day", now).toISOString()).toBe(
      "2026-06-18T00:00:00.000Z",
    );
    expect(earliestPickup(null, now).toISOString()).toBe(
      "2026-06-18T00:00:00.000Z",
    );
  });
});
