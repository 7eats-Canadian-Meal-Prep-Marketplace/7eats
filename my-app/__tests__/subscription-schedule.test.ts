import { describe, expect, it } from "vitest";
import {
  getNextFulfillmentDate,
  getNextPickupDate,
} from "@/lib/stripe/subscription-schedule";

describe("getNextPickupDate", () => {
  it("returns the same day when it is a pickup day", () => {
    // 2026-06-15 is a Monday
    const from = new Date("2026-06-15T10:00:00.000Z");
    const result = getNextPickupDate(from, ["monday"]);
    expect(result?.toISOString().slice(0, 10)).toBe("2026-06-15");
  });

  it("returns the next matching weekday when the same day doesn't match", () => {
    // 2026-06-15 is a Monday, next Wednesday is 2026-06-17
    const from = new Date("2026-06-15T10:00:00.000Z");
    const result = getNextPickupDate(from, ["wednesday"]);
    expect(result?.toISOString().slice(0, 10)).toBe("2026-06-17");
  });

  it("wraps around to the following week when needed", () => {
    // 2026-06-15 is a Monday, only Sunday available -> 2026-06-21
    const from = new Date("2026-06-15T10:00:00.000Z");
    const result = getNextPickupDate(from, ["sunday"]);
    expect(result?.toISOString().slice(0, 10)).toBe("2026-06-21");
  });

  it("picks the closest of multiple pickup days", () => {
    // 2026-06-15 is a Monday, closest of [friday, wednesday] is wednesday (2026-06-17)
    const from = new Date("2026-06-15T10:00:00.000Z");
    const result = getNextPickupDate(from, ["friday", "wednesday"]);
    expect(result?.toISOString().slice(0, 10)).toBe("2026-06-17");
  });

  it("returns null when there are no pickup days", () => {
    const from = new Date("2026-06-15T10:00:00.000Z");
    expect(getNextPickupDate(from, [])).toBeNull();
  });
});

describe("getNextFulfillmentDate", () => {
  it("uses currentPeriodEnd as the reference when it is in the future", () => {
    // currentPeriodEnd is a Thursday (2026-06-18), now is a Monday (2026-06-15)
    const currentPeriodEnd = new Date("2026-06-18T00:00:00.000Z");
    const now = new Date("2026-06-15T00:00:00.000Z");
    const result = getNextFulfillmentDate(currentPeriodEnd, ["thursday"], now);
    expect(result?.toISOString().slice(0, 10)).toBe("2026-06-18");
  });

  it("falls back to now when currentPeriodEnd is in the past", () => {
    const currentPeriodEnd = new Date("2026-06-01T00:00:00.000Z");
    const now = new Date("2026-06-15T00:00:00.000Z"); // Monday
    const result = getNextFulfillmentDate(currentPeriodEnd, ["monday"], now);
    expect(result?.toISOString().slice(0, 10)).toBe("2026-06-15");
  });

  it("falls back to now when currentPeriodEnd is null", () => {
    const now = new Date("2026-06-15T00:00:00.000Z"); // Monday
    const result = getNextFulfillmentDate(null, ["monday"], now);
    expect(result?.toISOString().slice(0, 10)).toBe("2026-06-15");
  });

  it("returns null when the cook has no pickup days configured", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    expect(getNextFulfillmentDate(null, [], now)).toBeNull();
  });
});
