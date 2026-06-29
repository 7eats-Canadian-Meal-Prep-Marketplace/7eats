import { describe, expect, it } from "vitest";
import { arrivalSlots, isArrivalWithinWindow } from "@/lib/delivery/arrival";

// Local-time construction matches the app's runtime-local window convention.
const at = (h: number, m = 0) => new Date(2026, 5, 26, h, m, 0, 0); // Fri Jun 26

describe("arrivalSlots", () => {
  it("generates 30-minute slots across the window, inclusive of both ends", () => {
    const slots = arrivalSlots(at(11), at(14));
    expect(slots.map((d) => d.getTime())).toEqual([
      at(11).getTime(),
      at(11, 30).getTime(),
      at(12).getTime(),
      at(12, 30).getTime(),
      at(13).getTime(),
      at(13, 30).getTime(),
      at(14).getTime(),
    ]);
  });

  it("honours a custom step", () => {
    const slots = arrivalSlots(at(11), at(12), 15);
    expect(slots).toHaveLength(5); // 11:00,11:15,11:30,11:45,12:00
  });

  it("never overshoots the window end on an uneven last step", () => {
    const slots = arrivalSlots(at(11), at(11, 40)); // 40-min window, 30-min step
    expect(slots.map((d) => d.getTime())).toEqual([
      at(11).getTime(),
      at(11, 30).getTime(),
    ]);
  });

  it("returns a single slot when start equals end", () => {
    expect(arrivalSlots(at(12), at(12))).toHaveLength(1);
  });

  it("returns empty when the window is missing or inverted", () => {
    expect(arrivalSlots(null, at(14))).toEqual([]);
    expect(arrivalSlots(at(14), at(11))).toEqual([]);
    expect(arrivalSlots(at(11), null)).toEqual([]);
  });

  it("accepts ISO strings", () => {
    const slots = arrivalSlots(at(11).toISOString(), at(12).toISOString());
    expect(slots).toHaveLength(3);
  });
});

describe("isArrivalWithinWindow", () => {
  it("accepts a time inside the window, including the boundaries", () => {
    expect(isArrivalWithinWindow(at(12), at(11), at(14))).toBe(true);
    expect(isArrivalWithinWindow(at(11), at(11), at(14))).toBe(true);
    expect(isArrivalWithinWindow(at(14), at(11), at(14))).toBe(true);
  });

  it("rejects a time before or after the window", () => {
    expect(isArrivalWithinWindow(at(10, 59), at(11), at(14))).toBe(false);
    expect(isArrivalWithinWindow(at(14, 1), at(11), at(14))).toBe(false);
  });

  it("rejects invalid/missing inputs", () => {
    expect(isArrivalWithinWindow(null, at(11), at(14))).toBe(false);
    expect(isArrivalWithinWindow(at(12), null, at(14))).toBe(false);
    expect(isArrivalWithinWindow("not-a-date", at(11), at(14))).toBe(false);
  });
});
