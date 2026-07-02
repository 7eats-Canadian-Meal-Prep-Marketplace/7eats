import { describe, expect, it } from "vitest";
import {
  clientOrderStatusLabel,
  clientOrderTrackerSteps,
} from "@/lib/client/order-status";

describe("clientOrderTrackerSteps", () => {
  it("maps pending to placed only", () => {
    expect(clientOrderTrackerSteps("pending", "pickup")).toEqual([
      { label: "Order placed", done: true },
      { label: "Order accepted", done: false },
      { label: "Ready for pickup", done: false },
      { label: "Picked up", done: false },
    ]);
  });

  it("maps confirmed to accepted", () => {
    const steps = clientOrderTrackerSteps("confirmed", "delivery");
    expect(steps[1]).toEqual({ label: "Order accepted", done: true });
    expect(steps[2]).toEqual({ label: "Ready for delivery", done: false });
  });

  it("maps ready without implying en route", () => {
    const steps = clientOrderTrackerSteps("ready", "delivery");
    expect(steps[2]).toEqual({ label: "Ready for delivery", done: true });
    expect(steps[3].done).toBe(false);
  });
});

describe("clientOrderStatusLabel", () => {
  it("uses ready wording for delivery", () => {
    expect(clientOrderStatusLabel("ready", "delivery")).toBe(
      "Ready for delivery",
    );
    expect(clientOrderStatusLabel("ready", "pickup")).toBe("Ready for pickup");
  });

  it("does not say out for delivery", () => {
    expect(clientOrderStatusLabel("ready", "delivery")).not.toContain(
      "Out for",
    );
  });
});
