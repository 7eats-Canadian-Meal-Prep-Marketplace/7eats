import { describe, expect, it } from "vitest";
import {
  addZonedDays,
  BUSINESS_TIMEZONE,
  zonedDayOfWeek,
  zonedParts,
  zonedTimeToUtc,
} from "@/lib/timezone";

describe("BUSINESS_TIMEZONE", () => {
  it("is America/Toronto", () => {
    expect(BUSINESS_TIMEZONE).toBe("America/Toronto");
  });
});

describe("zonedTimeToUtc", () => {
  it("round-trips a known EST date (Jan 15 2026, UTC-5)", () => {
    // 2026-01-15 22:00 Eastern (EST) is 2026-01-16 03:00 UTC.
    const utc = zonedTimeToUtc(2026, 1, 15, 22, 0, 0);
    expect(utc.toISOString()).toBe("2026-01-16T03:00:00.000Z");
    expect(zonedParts(utc)).toEqual({
      year: 2026,
      month: 1,
      day: 15,
      hour: 22,
      minute: 0,
      second: 0,
    });
  });

  it("round-trips a known EDT date (Jul 15 2026, UTC-4)", () => {
    // 2026-07-15 22:00 Eastern (EDT) is 2026-07-16 02:00 UTC.
    const utc = zonedTimeToUtc(2026, 7, 15, 22, 0, 0);
    expect(utc.toISOString()).toBe("2026-07-16T02:00:00.000Z");
    expect(zonedParts(utc)).toEqual({
      year: 2026,
      month: 7,
      day: 15,
      hour: 22,
      minute: 0,
      second: 0,
    });
  });

  it("defaults hour/minute/second to midnight", () => {
    const utc = zonedTimeToUtc(2026, 1, 15);
    expect(utc.toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });
});

describe("zonedDayOfWeek", () => {
  it("returns the Eastern weekday, not the UTC weekday", () => {
    // 2026-01-16T02:00:00.000Z is Jan 15 21:00 Eastern (Thursday), even
    // though the UTC calendar day is already Friday.
    const instant = new Date("2026-01-16T02:00:00.000Z");
    expect(zonedDayOfWeek(instant)).toBe(4); // Thursday
  });

  it("matches the Eastern calendar day for a midday instant", () => {
    // 2026-06-20 is a Saturday.
    const instant = zonedTimeToUtc(2026, 6, 20, 12, 0, 0);
    expect(zonedDayOfWeek(instant)).toBe(6); // Saturday
  });
});

describe("addZonedDays", () => {
  it("crosses a month boundary", () => {
    const instant = zonedTimeToUtc(2026, 1, 30, 10, 0, 0);
    const result = addZonedDays(instant, 3);
    expect(zonedParts(result)).toMatchObject({
      year: 2026,
      month: 2,
      day: 2,
      hour: 0,
      minute: 0,
      second: 0,
    });
  });

  it("crosses the spring-forward DST transition (Mar 8 2026)", () => {
    // EST->EDT transition is 2026-03-08. Start a few days before it and add
    // enough days to land after it; the Eastern wall-clock day should still
    // advance by exactly the requested number of days.
    const instant = zonedTimeToUtc(2026, 3, 6, 10, 0, 0);
    const result = addZonedDays(instant, 4);
    expect(zonedParts(result)).toMatchObject({
      year: 2026,
      month: 3,
      day: 10,
      hour: 0,
      minute: 0,
      second: 0,
    });
  });

  it("crosses the fall-back DST transition (Nov 1 2026)", () => {
    const instant = zonedTimeToUtc(2026, 10, 30, 10, 0, 0);
    const result = addZonedDays(instant, 4);
    expect(zonedParts(result)).toMatchObject({
      year: 2026,
      month: 11,
      day: 3,
      hour: 0,
      minute: 0,
      second: 0,
    });
  });
});
