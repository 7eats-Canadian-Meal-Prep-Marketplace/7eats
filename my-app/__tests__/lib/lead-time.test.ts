import { describe, expect, it } from "vitest";
import {
  cancelByDate,
  formatDbLeadTimeCutoff,
  formatOrderLeftLabel,
  generateFulfillmentSlotIsos,
  isPickupDayBookable,
  isRefundEligible,
  LEAD_TIME_CUTOFF_PRESETS,
  orderDeadlineForPickupDay,
  resolveOrderLeadTimeRules,
} from "@/lib/lead-time";

describe("lead-time cutoff", () => {
  it("defaults midnight behavior for 3-day lead", () => {
    const pickup = new Date(2026, 5, 18, 18, 0);
    const deadline = cancelByDate(pickup, {
      leadTime: "3_days",
      leadTimeCutoff: "23:59:59",
    });
    expect(deadline?.getFullYear()).toBe(2026);
    expect(deadline?.getMonth()).toBe(5);
    expect(deadline?.getDate()).toBe(15);
    expect(deadline?.getHours()).toBe(23);
    expect(deadline?.getMinutes()).toBe(59);
  });

  it("uses 10pm cutoff for 2-day lead", () => {
    const pickup = new Date(2026, 5, 20, 11, 0); // Saturday
    const deadline = orderDeadlineForPickupDay(pickup, 2, "22:00:00");
    expect(deadline.getDay()).toBe(4); // Thursday
    expect(deadline.getHours()).toBe(22);
    expect(deadline.getMinutes()).toBe(0);

    const before = new Date(2026, 5, 18, 21, 30); // Thu 9:30pm
    const after = new Date(2026, 5, 18, 22, 30); // Thu 10:30pm
    expect(isPickupDayBookable(pickup, 2, "22:00:00", before)).toBe(true);
    expect(isPickupDayBookable(pickup, 2, "22:00:00", after)).toBe(false);
  });

  it("excludes pickup days after the cutoff in slot generation", () => {
    const windows = [
      { dayOfWeek: "saturday", fromTime: "11:00:00", toTime: "14:00:00" },
    ];
    const now = new Date(2026, 5, 18, 22, 30); // Thu 10:30pm
    const slots = generateFulfillmentSlotIsos(
      windows,
      { leadTime: "2_days", leadTimeCutoff: "22:00:00" },
      now,
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(new Date(slots[0]).getDate()).toBe(27); // next Saturday, not Jun 20
  });

  it("includes the next open day once the cutoff passes", () => {
    const windows = [
      { dayOfWeek: "saturday", fromTime: "11:00:00", toTime: "14:00:00" },
    ];
    const now = new Date(2026, 5, 18, 21, 0); // Thu 9pm
    const slots = generateFulfillmentSlotIsos(
      windows,
      { leadTime: "2_days", leadTimeCutoff: "22:00:00" },
      now,
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(new Date(slots[0]).getDay()).toBe(6);
  });

  it("refund eligibility respects the cutoff time", () => {
    const pickup = new Date(2026, 5, 20, 11, 0);
    expect(
      isRefundEligible(
        pickup,
        { leadTime: "2_days", leadTimeCutoff: "22:00:00" },
        true,
        new Date(2026, 5, 18, 21, 59),
      ),
    ).toBe(true);
    expect(
      isRefundEligible(
        pickup,
        { leadTime: "2_days", leadTimeCutoff: "22:00:00" },
        true,
        new Date(2026, 5, 18, 22, 1),
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
});
