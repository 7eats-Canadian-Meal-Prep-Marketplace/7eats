import { describe, expect, it } from "vitest";
import {
  formatClientOrderTiming,
  formatOrderTimingLabel,
} from "@/lib/order-timing-label";

describe("formatClientOrderTiming", () => {
  it("uses fulfillment window when pickupAt is unset", () => {
    expect(
      formatClientOrderTiming({
        pickupAt: null,
        fulfillmentWindowStart: "2026-06-27T15:00:00.000Z",
        fulfillmentWindowEnd: "2026-06-27T18:00:00.000Z",
        fulfillmentMode: "delivery",
      }),
    ).toEqual({
      schedule: expect.stringMatching(/Jun 27 · \d+.*-\d+.*pm/),
      hint: "Exact time will be notified when your order is confirmed.",
    });
  });

  it("uses exact pickupAt when set", () => {
    const result = formatClientOrderTiming({
      pickupAt: "2026-06-27T16:30:00.000Z",
      fulfillmentWindowStart: "2026-06-27T15:00:00.000Z",
      fulfillmentWindowEnd: "2026-06-27T18:00:00.000Z",
      fulfillmentMode: "delivery",
    });
    expect(result.hint).toBeNull();
    expect(result.schedule).toContain("June");
  });
});

describe("formatOrderTimingLabel", () => {
  it("keeps email suffix for delivery windows", () => {
    const label = formatOrderTimingLabel({
      pickupAt: null,
      fulfillmentWindowStart: "2026-06-27T15:00:00.000Z",
      fulfillmentWindowEnd: "2026-06-27T18:00:00.000Z",
      fulfillmentMode: "delivery",
    });
    expect(label).toContain("exact time confirmed later");
  });
});
