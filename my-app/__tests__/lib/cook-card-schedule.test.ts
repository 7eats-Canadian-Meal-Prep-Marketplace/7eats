import { describe, expect, it } from "vitest";
import {
  type FulfillmentWindow,
  nextFulfillmentWindowLabel,
} from "@/lib/cook-card-schedule";

const deliveryWindows: FulfillmentWindow[] = [
  { dayOfWeek: "saturday", fromTime: "16:00:00", toTime: "19:00:00" },
];

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
