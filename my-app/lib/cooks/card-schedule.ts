import {
  cancelByDate,
  type FulfillmentWindow,
  formatOrderLeftLabel,
  generateFulfillmentSlotIsos,
  type LeadTimeRules,
} from "@/lib/lead-time";
import {
  BUSINESS_TIMEZONE,
  zonedDayOfWeek,
  zonedParts,
  zonedTimeToUtc,
} from "@/lib/timezone";

export type { FulfillmentWindow };

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DAY_SHORT: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${hour}${period}`
    : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function normalizeDay(day: string): string {
  return day.trim().toLowerCase();
}

function toRules(
  leadTime: string | null,
  leadTimeCutoff?: string | null,
): LeadTimeRules {
  return { leadTime, leadTimeCutoff };
}

function generateSlots(
  windows: FulfillmentWindow[],
  rules: LeadTimeRules,
  now: Date,
): string[] {
  return generateFulfillmentSlotIsos(windows, rules, now);
}

export type CookCardSchedule = {
  /** e.g. "Next pickup Fri · 11am–2pm" */
  schedule: string;
  /** Cover pill, e.g. "2 days left to order" */
  orderLeftLabel: string | null;
  urgent: boolean;
};

export function cookCardSchedule(
  mode: "pickup" | "delivery",
  pickupWindows: FulfillmentWindow[],
  deliveryWindows: FulfillmentWindow[],
  leadTime: string | null,
  now = new Date(),
  leadTimeCutoff?: string | null,
): CookCardSchedule | null {
  const windows = mode === "delivery" ? deliveryWindows : pickupWindows;
  const label = mode === "delivery" ? "delivery" : "pickup";
  const rules = toRules(leadTime, leadTimeCutoff);

  if (windows.length === 0) {
    return {
      schedule: `${mode === "delivery" ? "Delivery" : "Pickup"} not available`,
      orderLeftLabel: null,
      urgent: false,
    };
  }

  const slots = generateSlots(windows, rules, now);
  if (slots.length === 0) {
    return {
      schedule: `No ${label} slots soon`,
      orderLeftLabel: null,
      urgent: false,
    };
  }

  const first = new Date(slots[0]);
  const dayKey = DAY_NAMES[zonedDayOfWeek(first)];
  const win = windows.find((w) => normalizeDay(w.dayOfWeek) === dayKey);
  const dayLabel = DAY_SHORT[dayKey] ?? dayKey;
  const range = win
    ? `${fmtTime(win.fromTime)}–${fmtTime(win.toTime)}`
    : first.toLocaleTimeString("en-CA", {
        timeZone: BUSINESS_TIMEZONE,
        hour: "numeric",
        minute: "2-digit",
      });

  const schedule = `Next ${label} ${dayLabel} · ${range}`;

  const deadline = cancelByDate(slots[0], rules);
  let orderLeftLabel: string | null = null;
  let urgent = false;
  if (deadline && deadline > now) {
    orderLeftLabel = formatOrderLeftLabel(deadline, now);
    urgent = deadline.getTime() - now.getTime() < 24 * 3600_000;
  }

  return { schedule, orderLeftLabel, urgent };
}

/** Earliest valid slot timestamp for sort-by-soonest. Null when none. */
export function firstSlotTimestamp(
  mode: "pickup" | "delivery",
  pickupWindows: FulfillmentWindow[],
  deliveryWindows: FulfillmentWindow[],
  leadTime: string | null,
  now = new Date(),
  leadTimeCutoff?: string | null,
): number | null {
  const windows = mode === "delivery" ? deliveryWindows : pickupWindows;
  const slots = generateSlots(windows, toRules(leadTime, leadTimeCutoff), now);
  if (slots.length === 0) return null;
  const t = new Date(slots[0]).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Customer-facing label for the next open fulfillment window (range, not a slot). */
export function nextFulfillmentWindowLabel(
  mode: "pickup" | "delivery",
  pickupWindows: FulfillmentWindow[],
  deliveryWindows: FulfillmentWindow[],
  leadTime: string | null,
  now = new Date(),
  leadTimeCutoff?: string | null,
): string | null {
  const windows = mode === "delivery" ? deliveryWindows : pickupWindows;
  const modeLabel = mode === "delivery" ? "Delivery" : "Pickup";
  if (windows.length === 0) return null;

  const slots = generateSlots(windows, toRules(leadTime, leadTimeCutoff), now);
  if (slots.length === 0) return null;

  const first = new Date(slots[0]);
  const dayKey = DAY_NAMES[zonedDayOfWeek(first)];
  const win = windows.find((w) => normalizeDay(w.dayOfWeek) === dayKey) ?? null;
  const dayPart = first.toLocaleString("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (!win) return `${modeLabel} · ${dayPart}`;
  return `${modeLabel} · ${dayPart} · ${fmtTime(win.fromTime)}–${fmtTime(win.toTime)}`;
}

/** First eligible slot ISO for refund cutoffs on the menu only (not stored on orders). */
export function nextFulfillmentSlotIso(
  mode: "pickup" | "delivery",
  pickupWindows: FulfillmentWindow[],
  deliveryWindows: FulfillmentWindow[],
  leadTime: string | null,
  now = new Date(),
  leadTimeCutoff?: string | null,
): string | null {
  const windows = mode === "delivery" ? deliveryWindows : pickupWindows;
  const slots = generateSlots(windows, toRules(leadTime, leadTimeCutoff), now);
  return slots[0] ?? null;
}

/**
 * Earliest eligible fulfillment window for an order, snapshotted at placement.
 */
export function earliestFulfillmentWindow(
  mode: "pickup" | "delivery",
  pickupWindows: FulfillmentWindow[],
  deliveryWindows: FulfillmentWindow[],
  leadTime: string | null,
  now = new Date(),
  leadTimeCutoff?: string | null,
): { start: Date; end: Date } | null {
  const windows = mode === "delivery" ? deliveryWindows : pickupWindows;
  if (windows.length === 0) return null;

  const slots = generateSlots(windows, toRules(leadTime, leadTimeCutoff), now);
  if (slots.length === 0) return null;

  const first = new Date(slots[0]);
  const dayKey = DAY_NAMES[zonedDayOfWeek(first)];
  const win = windows.find((w) => normalizeDay(w.dayOfWeek) === dayKey);
  if (!win) return null;

  const [fh, fm] = win.fromTime.split(":").map(Number);
  const [th, tm] = win.toTime.split(":").map(Number);
  const { year, month, day } = zonedParts(first);
  const start = zonedTimeToUtc(year, month, day, fh, fm, 0);
  const end = zonedTimeToUtc(year, month, day, th, tm, 0);
  return { start, end };
}
