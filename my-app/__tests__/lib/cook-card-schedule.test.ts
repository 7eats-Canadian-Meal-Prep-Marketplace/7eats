import { describe, expect, it } from "vitest";
import {
  cookCardSchedule,
  earliestFulfillmentWindow,
  type FulfillmentWindow,
  nextFulfillmentWindowLabel,
} from "@/lib/cooks/card-schedule";
import { zonedDayOfWeek, zonedParts, zonedTimeToUtc } from "@/lib/timezone";

const pickupWindows: FulfillmentWindow[] = [
  { dayOfWeek: "friday", fromTime: "11:00:00", toTime: "14:00:00" },
  { dayOfWeek: "saturday", fromTime: "10:00:00", toTime: "13:00:00" },
];

const deliveryWindows: FulfillmentWindow[] = [
  { dayOfWeek: "saturday", fromTime: "16:00:00", toTime: "19:00:00" },
];

describe("earliestFulfillmentWindow", () => {
  it("returns null when there are no windows for the mode", () => {
    expect(
      earliestFulfillmentWindow("pickup", [], deliveryWindows, null),
    ).toBeNull();
  });

  it("skips days inside lead time", () => {
    const now = new Date(2026, 5, 15, 12, 0, 0); // Monday Jun 15
    const result = earliestFulfillmentWindow(
      "pickup",
      pickupWindows,
      [],
      "2_days",
      now,
      "23:59:59",
    );
    expect(result).not.toBeNull();
    expect(zonedDayOfWeek(result?.start as Date)).toBe(5); // Friday - Mon/Tue skipped by 2-day lead
    expect(zonedParts(result?.start as Date).hour).toBe(11);
    expect(zonedParts(result?.end as Date).hour).toBe(14);
  });

  it("returns the earliest matching weekday window range", () => {
    const now = new Date(2026, 5, 15, 12, 0, 0); // Monday Jun 15
    const result = earliestFulfillmentWindow(
      "pickup",
      pickupWindows,
      [],
      null,
      now,
    );
    expect(result).not.toBeNull();
    expect(zonedDayOfWeek(result?.start as Date)).toBe(5); // Friday Jun 19
    expect(zonedParts(result?.start as Date)).toMatchObject({
      hour: 11,
      minute: 0,
    });
    expect(zonedParts(result?.end as Date)).toMatchObject({
      hour: 14,
      minute: 0,
    });
  });

  it("uses delivery windows when mode is delivery", () => {
    const now = new Date(2026, 5, 15, 12, 0, 0);
    const result = earliestFulfillmentWindow(
      "delivery",
      pickupWindows,
      deliveryWindows,
      null,
      now,
    );
    expect(result).not.toBeNull();
    expect(zonedDayOfWeek(result?.start as Date)).toBe(6); // Saturday
    expect(zonedParts(result?.start as Date).hour).toBe(16);
    expect(zonedParts(result?.end as Date).hour).toBe(19);
  });

  it("respects a 10pm cutoff when generating the next window", () => {
    const now = zonedTimeToUtc(2026, 6, 18, 22, 30, 0); // Thu 10:30pm Eastern
    const result = earliestFulfillmentWindow(
      "pickup",
      [{ dayOfWeek: "saturday", fromTime: "10:00:00", toTime: "13:00:00" }],
      [],
      "2_days",
      now,
      "22:00:00",
    );
    expect(result).not.toBeNull();
    expect(zonedDayOfWeek(result?.start as Date)).toBe(6);
    expect(zonedParts(result?.start as Date).day).toBe(27);
  });
});

describe("nextFulfillmentWindowLabel", () => {
  it("shows delivery window range, not a single slot time", () => {
    const label = nextFulfillmentWindowLabel(
      "delivery",
      [],
      deliveryWindows,
      null,
      new Date(2026, 5, 15, 12, 0, 0),
    );

    expect(label).toMatch(/Delivery ·/);
    expect(label).toMatch(/4pm–7pm/);
    expect(label).not.toMatch(/4:00/);
  });

  it("uses the business timezone weekday when the slot falls on the next UTC day", () => {
    const label = nextFulfillmentWindowLabel(
      "pickup",
      [{ dayOfWeek: "wednesday", fromTime: "22:00:00", toTime: "23:00:00" }],
      [],
      null,
      new Date("2026-07-15T23:30:00.000Z"), // Wednesday 7:30pm Eastern
    );

    expect(label).toContain("Wed");
    expect(label).toContain("10pm–11pm");
  });
});

describe("cookCardSchedule", () => {
  it("uses the business timezone weekday when matching the next card window", () => {
    const card = cookCardSchedule(
      "pickup",
      [{ dayOfWeek: "wednesday", fromTime: "22:00:00", toTime: "23:00:00" }],
      [],
      null,
      new Date("2026-07-15T23:30:00.000Z"), // Wednesday 7:30pm Eastern
    );

    expect(card?.schedule).toBe("Next pickup Wed · 10pm–11pm");
  });
});
