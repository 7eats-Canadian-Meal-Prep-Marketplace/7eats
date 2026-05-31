import { describe, expect, it } from "vitest";
import { INTERVAL_MAP } from "./stripe-subscriptions";

describe("INTERVAL_MAP", () => {
  it("maps weekly to Stripe week/1", () => {
    expect(INTERVAL_MAP.weekly).toEqual({
      interval: "week",
      interval_count: 1,
    });
  });

  it("maps biweekly to Stripe week/2", () => {
    expect(INTERVAL_MAP.biweekly).toEqual({
      interval: "week",
      interval_count: 2,
    });
  });

  it("maps monthly to Stripe month/1", () => {
    expect(INTERVAL_MAP.monthly).toEqual({
      interval: "month",
      interval_count: 1,
    });
  });

  it("covers all three intervals", () => {
    expect(Object.keys(INTERVAL_MAP)).toHaveLength(3);
  });
});
