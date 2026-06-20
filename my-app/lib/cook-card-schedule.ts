import { cancelByDate, LEAD_TIME_DAYS_MAP } from "@/lib/refund-policy";

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

const SLOT_INTERVAL_MIN = 30;
const PICKUP_DAYS_AHEAD = 14;

export type FulfillmentWindow = {
  dayOfWeek: string;
  fromTime: string;
  toTime: string;
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

function generateSlots(
  windows: FulfillmentWindow[],
  leadTime: string | null,
  now: Date,
): string[] {
  if (windows.length === 0) return [];
  const leadDays = leadTime ? (LEAD_TIME_DAYS_MAP[leadTime] ?? 0) : 0;
  const byDay = new Map(windows.map((w) => [normalizeDay(w.dayOfWeek), w]));
  const slots: string[] = [];
  for (let d = 0; d < PICKUP_DAYS_AHEAD; d++) {
    if (d < leadDays) continue;
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const win = byDay.get(DAY_NAMES[day.getDay()]);
    if (!win) continue;
    const [fh, fm] = win.fromTime.split(":").map(Number);
    const [th, tm] = win.toTime.split(":").map(Number);
    const start = new Date(day);
    start.setHours(fh, fm, 0, 0);
    const end = new Date(day);
    end.setHours(th, tm, 0, 0);
    for (
      let t = start;
      t < end;
      t = new Date(t.getTime() + SLOT_INTERVAL_MIN * 60_000)
    ) {
      if (t <= now) continue;
      slots.push(t.toISOString());
    }
  }
  return slots;
}

export type CookCardSchedule = {
  /** e.g. "Next pickup Fri · 11am–2pm" */
  schedule: string;
  /** Cover pill, e.g. "2 days left to order" */
  orderLeftLabel: string | null;
  urgent: boolean;
};

function formatOrderLeftLabel(deadline: Date, now: Date): string | null {
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return null;
  const hours = Math.ceil(ms / 3600_000);
  if (hours < 24) {
    return hours === 1
      ? "1 hour left to order"
      : `${hours} hours left to order`;
  }
  const days = Math.ceil(ms / (24 * 3600_000));
  return days === 1 ? "1 day left to order" : `${days} days left to order`;
}

export function cookCardSchedule(
  mode: "pickup" | "delivery",
  pickupWindows: FulfillmentWindow[],
  deliveryWindows: FulfillmentWindow[],
  leadTime: string | null,
  now = new Date(),
): CookCardSchedule | null {
  const windows = mode === "delivery" ? deliveryWindows : pickupWindows;
  const label = mode === "delivery" ? "delivery" : "pickup";

  if (windows.length === 0) {
    return {
      schedule: `${mode === "delivery" ? "Delivery" : "Pickup"} not available`,
      orderLeftLabel: null,
      urgent: false,
    };
  }

  const slots = generateSlots(windows, leadTime, now);
  if (slots.length === 0) {
    return {
      schedule: `No ${label} slots soon`,
      orderLeftLabel: null,
      urgent: false,
    };
  }

  const first = new Date(slots[0]);
  const dayKey = DAY_NAMES[first.getDay()];
  const win = windows.find((w) => normalizeDay(w.dayOfWeek) === dayKey);
  const dayLabel = DAY_SHORT[dayKey] ?? dayKey;
  const range = win
    ? `${fmtTime(win.fromTime)}–${fmtTime(win.toTime)}`
    : first.toLocaleTimeString("en-CA", {
        hour: "numeric",
        minute: "2-digit",
      });

  const schedule = `Next ${label} ${dayLabel} · ${range}`;

  const deadline = cancelByDate(slots[0], leadTime);
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
): number | null {
  const windows = mode === "delivery" ? deliveryWindows : pickupWindows;
  const slots = generateSlots(windows, leadTime, now);
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
): string | null {
  const windows = mode === "delivery" ? deliveryWindows : pickupWindows;
  const modeLabel = mode === "delivery" ? "Delivery" : "Pickup";
  if (windows.length === 0) return null;

  const slots = generateSlots(windows, leadTime, now);
  if (slots.length === 0) return null;

  const first = new Date(slots[0]);
  const dayKey = DAY_NAMES[first.getDay()];
  const win = windows.find((w) => normalizeDay(w.dayOfWeek) === dayKey) ?? null;
  const dayPart = first.toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (!win) return `${modeLabel} · ${dayPart}`;
  return `${modeLabel} · ${dayPart} · ${fmtTime(win.fromTime)}–${fmtTime(win.toTime)}`;
}

/** First eligible slot ISO — for refund cutoffs on the menu only (not stored on orders). */
export function nextFulfillmentSlotIso(
  mode: "pickup" | "delivery",
  pickupWindows: FulfillmentWindow[],
  deliveryWindows: FulfillmentWindow[],
  leadTime: string | null,
  now = new Date(),
): string | null {
  const windows = mode === "delivery" ? deliveryWindows : pickupWindows;
  const slots = generateSlots(windows, leadTime, now);
  return slots[0] ?? null;
}
