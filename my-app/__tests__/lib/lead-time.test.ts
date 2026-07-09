import { describe, expect, it } from "vitest";
import {
  cancelByDate,
  formatDbLeadTimeCutoff,
  formatOrderLeftLabel,
  generateFulfillmentSlotIsos,
  isPickupDayBookable,
  isRefundEligible,
  LEAD_TIME_CUTOFF_PRESETS,
  leadTimeExampleText,
  orderDeadlineForPickupDay,
  resolveOrderLeadTimeRules,
} from "@/lib/lead-time";
import { zonedDayOfWeek, zonedParts, zonedTimeToUtc } from "@/lib/timezone";

const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  zonedTimeToUtc(year, month, day, hour, minute, 0);

describe("lead-time cutoff", () => {
  it("defaults midnight behavior for 3-day lead", () => {
    const pickup = at(2026, 6, 18, 18);
    const deadline = cancelByDate(pickup, {
      leadTime: "3_days",
      leadTimeCutoff: "23:59:59",
    });
    expect(deadline && zonedParts(deadline)).toMatchObject({
      year: 2026,
      month: 6,
      day: 15,
      hour: 23,
      minute: 59,
    });
  });

  it("uses 10pm cutoff for 2-day lead", () => {
    const pickup = at(2026, 6, 20, 11); // Saturday
    const deadline = orderDeadlineForPickupDay(pickup, 2, "22:00:00");
    expect(zonedDayOfWeek(deadline)).toBe(4); // Thursday
    expect(zonedParts(deadline)).toMatchObject({ hour: 22, minute: 0 });

    const before = at(2026, 6, 18, 21, 30); // Thu 9:30pm
    const after = at(2026, 6, 18, 22, 30); // Thu 10:30pm
    expect(isPickupDayBookable(pickup, 2, "22:00:00", before)).toBe(true);
    expect(isPickupDayBookable(pickup, 2, "22:00:00", after)).toBe(false);
  });

  it("excludes pickup days after the cutoff in slot generation", () => {
    const windows = [
      { dayOfWeek: "saturday", fromTime: "11:00:00", toTime: "14:00:00" },
    ];
    const now = at(2026, 6, 18, 22, 30); // Thu 10:30pm
    const slots = generateFulfillmentSlotIsos(
      windows,
      { leadTime: "2_days", leadTimeCutoff: "22:00:00" },
      now,
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(zonedParts(new Date(slots[0])).day).toBe(27); // next Saturday, not Jun 20
  });

  it("includes the next open day once the cutoff passes", () => {
    const windows = [
      { dayOfWeek: "saturday", fromTime: "11:00:00", toTime: "14:00:00" },
    ];
    const now = at(2026, 6, 18, 21); // Thu 9pm
    const slots = generateFulfillmentSlotIsos(
      windows,
      { leadTime: "2_days", leadTimeCutoff: "22:00:00" },
      now,
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(zonedDayOfWeek(new Date(slots[0]))).toBe(6);
  });

  it("refund eligibility respects the cutoff time", () => {
    const pickup = at(2026, 6, 20, 11);
    expect(
      isRefundEligible(
        pickup,
        { leadTime: "2_days", leadTimeCutoff: "22:00:00" },
        true,
        at(2026, 6, 18, 21, 59),
      ),
    ).toBe(true);
    expect(
      isRefundEligible(
        pickup,
        { leadTime: "2_days", leadTimeCutoff: "22:00:00" },
        true,
        at(2026, 6, 18, 22, 1),
      ),
    ).toBe(false);
  });

  it("formats order-left labels with hours when under one day", () => {
    const now = new Date(2026, 5, 18, 20, 0);
    const deadline = new Date(2026, 5, 18, 22, 0);
    expect(formatOrderLeftLabel(deadline, now)).toBe("2 hours left to order");
  });

  it("offers hourly cutoffs from noon through midnight default", () => {
    expect(LEAD_TIME_CUTOFF_PRESETS[0]?.value).toBe("12:00:00");
    expect(LEAD_TIME_CUTOFF_PRESETS[11]?.value).toBe("23:00:00");
    expect(LEAD_TIME_CUTOFF_PRESETS.at(-1)?.value).toBe("23:59:59");
    expect(LEAD_TIME_CUTOFF_PRESETS).toHaveLength(13);
  });

  it("normalizes ISO datetime cutoffs from API JSON", () => {
    expect(formatDbLeadTimeCutoff("1970-01-01T22:00:00.000Z")).toBe("22:00:00");
  });

  it("prefers order snapshots over live cook profile", () => {
    const rules = resolveOrderLeadTimeRules({
      leadTimeSnapshot: "2_days",
      leadTimeCutoffSnapshot: "22:00:00",
      cookLeadTime: "3_days",
      cookLeadTimeCutoff: "23:59:59",
    });
    expect(rules.leadTime).toBe("2_days");
    expect(rules.leadTimeCutoff).toBe("22:00:00");
  });

  it("builds cutoff examples from enabled pickup windows", () => {
    const text = leadTimeExampleText("2_days", "22:00:00", {
      fulfillmentMode: "pickup",
      pickupWindows: [
        {
          dayOfWeek: "saturday",
          fromTime: "11:00",
          toTime: "14:00",
        },
      ],
    });
    expect(text).toContain("Saturday pickup at 11 a.m.");
    expect(text).toContain("orders close Thursday at 10 p.m.");
    expect(text).not.toContain("2 days earlier");
  });

  it("builds cutoff examples from enabled delivery windows", () => {
    const text = leadTimeExampleText("1_day", "23:59:59", {
      fulfillmentMode: "delivery",
      deliveryWindows: [
        {
          dayOfWeek: "friday",
          fromTime: "17:30",
          toTime: "20:00",
        },
      ],
    });
    expect(text).toContain("Friday delivery at 5:30 p.m.");
    expect(text).toContain("orders close Thursday at midnight");
  });
});
