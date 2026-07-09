// Wall-clock timezone helpers for the business timezone. 7eats is Ontario-only,
// so every cook-configured cutoff/window time ("22:00:00", "11:00-14:00", etc.)
// is meant to be interpreted in America/Toronto, not the server process's local
// timezone. Production runs on Vercel, which defaults to UTC, so any code that
// used raw Date getters/setters (getFullYear/getMonth/getDate/setHours) was
// silently doing day-boundary math in UTC instead of Eastern time.
//
// Built on Intl.DateTimeFormat only, no timezone library dependency.

export const BUSINESS_TIMEZONE = "America/Toronto";

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Wall-clock components of `instant` as seen in BUSINESS_TIMEZONE. */
export function zonedParts(instant: Date): ZonedParts {
  const parts = formatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * The UTC instant corresponding to the given wall-clock date/time in
 * BUSINESS_TIMEZONE. Uses the standard two-pass technique: build a guess UTC
 * instant from the wall-clock fields, see what Eastern wall time that guess
 * actually represents, then correct the guess by the observed offset. Handles
 * both EST and EDT.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const seen = zonedParts(guess);
  const seenAsUtc = Date.UTC(
    seen.year,
    seen.month - 1,
    seen.day,
    seen.hour,
    seen.minute,
    seen.second,
  );
  const offsetMs = seenAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

/** Day-of-week (0 = Sunday ... 6 = Saturday) of `instant` as seen in BUSINESS_TIMEZONE. */
export function zonedDayOfWeek(instant: Date): number {
  const { year, month, day } = zonedParts(instant);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The UTC instant for Eastern midnight of (Eastern calendar day of `instant` + days). */
export function addZonedDays(instant: Date, days: number): Date {
  const { year, month, day } = zonedParts(instant);
  return zonedTimeToUtc(year, month, day + days, 0, 0, 0);
}
