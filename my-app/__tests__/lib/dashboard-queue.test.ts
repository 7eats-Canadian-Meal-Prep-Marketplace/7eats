import { describe, expect, it } from "vitest";
import {
  nextPickupDayOrders,
  type QueueScheduleOrder,
  queueScheduleIso,
} from "@/lib/dashboard-queue";

const iso = (y: number, mo: number, d: number, h = 12) =>
  new Date(y, mo - 1, d, h, 0, 0, 0).toISOString();

describe("queueScheduleIso", () => {
  it("prefers the pinned pickupAt minute", () => {
    expect(
      queueScheduleIso({
        pickupAt: iso(2026, 6, 26, 17),
        fulfillmentWindowStart: iso(2026, 6, 26, 11),
      }),
    ).toBe(iso(2026, 6, 26, 17));
  });

  it("falls back to the fulfillment window when pickupAt is null", () => {
    // This is the dominant case: a freshly placed order has no pickupAt yet.
    expect(
      queueScheduleIso({
        pickupAt: null,
        fulfillmentWindowStart: iso(2026, 6, 26, 11),
      }),
    ).toBe(iso(2026, 6, 26, 11));
  });

  it("returns null when nothing is scheduled", () => {
    expect(
      queueScheduleIso({ pickupAt: null, fulfillmentWindowStart: null }),
    ).toBeNull();
  });
});

describe("nextPickupDayOrders", () => {
  const make = (
    id: string,
    status: "pending" | "confirmed" | "ready",
    pickupAt: string | null,
    fulfillmentWindowStart: string | null,
  ): QueueScheduleOrder & { id: string; status: string } => ({
    id,
    status,
    pickupAt,
    fulfillmentWindowStart,
  });

  it("groups the earliest day using the window when pickupAt is null", () => {
    const orders = [
      make("a", "confirmed", null, iso(2026, 6, 27, 11)),
      make("b", "confirmed", null, iso(2026, 6, 26, 12)), // earliest
      make("c", "confirmed", null, iso(2026, 6, 26, 18)), // same day as b
    ];
    const { orders: day } = nextPickupDayOrders(orders);
    expect(day.map((o) => o.id)).toEqual(["b", "c"]);
  });

  it("ignores pending requests and unscheduled orders", () => {
    const orders = [
      make("pending", "pending", null, iso(2026, 6, 26, 11)),
      make("noschedule", "confirmed", null, null),
      make("ok", "confirmed", null, iso(2026, 6, 26, 11)),
    ];
    const { orders: day } = nextPickupDayOrders(orders);
    expect(day.map((o) => o.id)).toEqual(["ok"]);
  });

  it("returns an empty list when there are no scheduled confirmed orders", () => {
    expect(nextPickupDayOrders([]).orders).toEqual([]);
  });
});
