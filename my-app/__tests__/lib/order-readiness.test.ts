import { describe, expect, it } from "vitest";
import { canMarkReady, readyAvailableFrom } from "@/lib/orders/readiness";
import { zonedParts, zonedTimeToUtc } from "@/lib/timezone";

// All dates are constructed with Toronto wall-clock fields to match the app's
// business timezone, regardless of the test runner's process timezone.
const at = (y: number, mo: number, d: number, h = 12) =>
  zonedTimeToUtc(y, mo, d, h, 0, 0);

describe("canMarkReady", () => {
  const now = at(2026, 6, 25, 10); // Thu Jun 25 2026, 10:00 local

  it("blocks marking ready two or more days before fulfillment", () => {
    // Fulfillment Sat Jun 27 — still the day-after-tomorrow from `now`.
    expect(
      canMarkReady({ fulfillmentWindowStart: at(2026, 6, 27, 11) }, now),
    ).toBe(false);
  });

  it("allows marking ready the calendar day before, regardless of time", () => {
    // Fulfillment Fri Jun 26; `now` is Thu Jun 25 — the day before. Even at
    // 00:05 local on the 25th it should be allowed.
    const early = at(2026, 6, 25, 0);
    early.setUTCMinutes(early.getUTCMinutes() + 5);
    expect(
      canMarkReady({ fulfillmentWindowStart: at(2026, 6, 26, 11) }, early),
    ).toBe(true);
  });

  it("allows marking ready on the fulfillment day", () => {
    expect(
      canMarkReady({ fulfillmentWindowStart: at(2026, 6, 25, 18) }, now),
    ).toBe(true);
  });

  it("allows marking ready when the window is already in the past", () => {
    expect(
      canMarkReady({ fulfillmentWindowStart: at(2026, 6, 24, 11) }, now),
    ).toBe(true);
  });

  it("prefers the exact pickupAt minute over the window start", () => {
    // pickupAt is two days out even though a stale window start is today.
    expect(
      canMarkReady(
        {
          pickupAt: at(2026, 6, 27, 18),
          fulfillmentWindowStart: at(2026, 6, 25, 11),
        },
        now,
      ),
    ).toBe(false);
  });

  it("allows marking ready when no schedule is set (nothing to guard)", () => {
    expect(canMarkReady({}, now)).toBe(true);
    expect(
      canMarkReady({ pickupAt: null, fulfillmentWindowStart: null }, now),
    ).toBe(true);
  });

  it("accepts ISO strings as well as Date objects", () => {
    expect(
      canMarkReady(
        { fulfillmentWindowStart: at(2026, 6, 27, 11).toISOString() },
        now,
      ),
    ).toBe(false);
  });
});

describe("readyAvailableFrom", () => {
  it("returns local midnight of the day before fulfillment", () => {
    const from = readyAvailableFrom({
      fulfillmentWindowStart: at(2026, 6, 26, 11),
    });
    expect(from).not.toBeNull();
    expect(from && zonedParts(from)).toMatchObject({
      year: 2026,
      month: 6,
      day: 25,
      hour: 0,
      minute: 0,
    });
  });

  it("returns null when no schedule is set", () => {
    expect(readyAvailableFrom({})).toBeNull();
  });
});
