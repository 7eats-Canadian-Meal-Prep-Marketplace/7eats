import { describe, expect, it } from "vitest";
import {
  earliestFulfillmentWindow,
  type FulfillmentWindow,
  nextFulfillmentWindowLabel,
} from "@/lib/cook-card-schedule";

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
    expect(result?.start.getDay()).toBe(5); // Friday — Mon/Tue skipped by 2-day lead
    expect(result?.start.getHours()).toBe(11);
    expect(result?.end.getHours()).toBe(14);
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
    expect(result?.start.getDay()).toBe(5); // Friday Jun 19
    expect(result?.start.getHours()).toBe(11);
    expect(result?.start.getMinutes()).toBe(0);
    expect(result?.end.getHours()).toBe(14);
    expect(result?.end.getMinutes()).toBe(0);
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
    expect(result?.start.getDay()).toBe(6); // Saturday
    expect(result?.start.getHours()).toBe(16);
    expect(result?.end.getHours()).toBe(19);
  });

  it("respects a 10pm cutoff when generating the next window", () => {
    const now = new Date(2026, 5, 18, 22, 30, 0); // Thu 10:30pm
    const result = earliestFulfillmentWindow(
      "pickup",
      [{ dayOfWeek: "saturday", fromTime: "10:00:00", toTime: "13:00:00" }],
      [],
      "2_days",
      now,
      "22:00:00",
    );
    expect(result).not.toBeNull();
    expect(result?.start.getDay()).toBe(6);
    expect(result?.start.getDate()).toBe(27);
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
});
