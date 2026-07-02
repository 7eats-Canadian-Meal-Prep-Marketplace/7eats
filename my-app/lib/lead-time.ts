import type { leadTimeEnum } from "@/db/schema";

type LeadTime = (typeof leadTimeEnum.enumValues)[number];

/** End of calendar day; preserves legacy midnight cutoff behavior. */
export const DEFAULT_LEAD_TIME_CUTOFF = "23:59:59";

function formatHourPresetLabel(hour: number, minute = 0): string {
  const d = new Date(2000, 0, 1, hour, minute, 0);
  return d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: minute === 0 ? undefined : "2-digit",
  });
}

/** Optional hourly cutoffs from noon through 11 pm, plus midnight (default). */
export const LEAD_TIME_CUTOFF_PRESETS = [
  ...Array.from({ length: 12 }, (_, i) => {
    const hour = 12 + i;
    return {
      value: `${String(hour).padStart(2, "0")}:00:00`,
      label: formatHourPresetLabel(hour),
    };
  }),
  { value: DEFAULT_LEAD_TIME_CUTOFF, label: "Midnight (default)" },
] as const;

export const LEAD_TIME_DAYS: Record<LeadTime, number> = {
  same_day: 0,
  "1_day": 1,
  "2_days": 2,
  "3_days": 3,
  "4_days": 4,
  "5_days": 5,
};

/** @deprecated Use LEAD_TIME_DAYS from this module. Kept for older imports. */
export const LEAD_TIME_DAYS_MAP: Record<string, number> = LEAD_TIME_DAYS;

export const LEAD_TIME_HOURS: Record<LeadTime, number> = {
  same_day: 0,
  "1_day": 24,
  "2_days": 48,
  "3_days": 72,
  "4_days": 96,
  "5_days": 120,
};

const LEAD_TIME_LABELS: Record<string, string> = {
  same_day: "Same day",
  "1_day": "1 day",
  "2_days": "2 days",
  "3_days": "3 days",
  "4_days": "4 days",
  "5_days": "5 days",
};

export type FulfillmentWindow = {
  dayOfWeek: string;
  fromTime: string;
  toTime: string;
};

export type LeadTimeRules = {
  leadTime: string | null;
  leadTimeCutoff?: string | null;
};

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export const PICKUP_DAYS_AHEAD = 14;
export const SLOT_INTERVAL_MIN = 30;

function parseCutoffParts(cutoff: string): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const normalized = normalizeLeadTimeCutoff(cutoff);
  const [h, m, s = "0"] = normalized.split(":");
  return {
    hours: Number(h),
    minutes: Number(m),
    seconds: Number(s),
  };
}

/** Normalize HH:MM or HH:MM:SS to HH:MM:SS. */
export function normalizeLeadTimeCutoff(
  raw: string | null | undefined,
): string {
  const trimmed = (raw ?? DEFAULT_LEAD_TIME_CUTOFF).trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return DEFAULT_LEAD_TIME_CUTOFF;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "0");
  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return DEFAULT_LEAD_TIME_CUTOFF;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function isValidLeadTimeCutoff(raw: string): boolean {
  const trimmed = raw.trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "0");
  return (
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59 &&
    seconds >= 0 &&
    seconds <= 59
  );
}

export function resolveLeadTimeCutoff(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_LEAD_TIME_CUTOFF;
  return normalizeLeadTimeCutoff(raw);
}

export function leadTimeDays(leadTime: string | null): number {
  if (!leadTime) return 0;
  return LEAD_TIME_DAYS[leadTime as LeadTime] ?? 0;
}

export function formatLeadTime(leadTime: string | null): string | null {
  if (!leadTime) return null;
  return LEAD_TIME_LABELS[leadTime] ?? leadTime.replace(/_/g, " ");
}

export function formatLeadTimeCutoffLabel(
  cutoff: string | null | undefined,
): string {
  const normalized = resolveLeadTimeCutoff(cutoff);
  if (normalized === "23:59:59") return "midnight";
  const { hours, minutes } = parseCutoffParts(normalized);
  const d = new Date(2000, 0, 1, hours, minutes, 0);
  return d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: minutes === 0 ? undefined : "2-digit",
  });
}

/**
 * Last moment a customer can place or cancel an order for a given pickup day.
 * Pickup Saturday with 2-day lead and 10:00 pm cutoff closes Thursday at 10:00 pm.
 */
export function orderDeadlineForPickupDay(
  pickupDay: Date,
  leadDays: number,
  cutoffTime?: string | null,
): Date {
  const { hours, minutes, seconds } = parseCutoffParts(
    resolveLeadTimeCutoff(cutoffTime),
  );
  const deadline = new Date(
    pickupDay.getFullYear(),
    pickupDay.getMonth(),
    pickupDay.getDate() - leadDays,
  );
  deadline.setHours(hours, minutes, seconds, 0);
  return deadline;
}

export function isPickupDayBookable(
  pickupDay: Date,
  leadDays: number,
  cutoffTime: string | null | undefined,
  now: Date,
): boolean {
  return (
    now.getTime() <=
    orderDeadlineForPickupDay(pickupDay, leadDays, cutoffTime).getTime()
  );
}

export function cancelByDate(
  pickupAtIso: string | Date | null,
  rules: LeadTimeRules,
): Date | null {
  if (!pickupAtIso) return null;
  const pickup =
    pickupAtIso instanceof Date ? pickupAtIso : new Date(pickupAtIso);
  if (Number.isNaN(pickup.getTime())) return null;
  const days = leadTimeDays(rules.leadTime);
  return orderDeadlineForPickupDay(pickup, days, rules.leadTimeCutoff);
}

/** Exclusive instant after which refunds are no longer allowed. */
export function refundCutoffExclusive(
  pickupAt: Date,
  rules: LeadTimeRules,
): Date | null {
  const inclusive = cancelByDate(pickupAt, rules);
  if (!inclusive) return null;
  return new Date(inclusive.getTime() + 1);
}

export function isRefundEligible(
  pickupAt: Date | null,
  rules: LeadTimeRules,
  cancellationAllowed: boolean,
  now: Date = new Date(),
): boolean {
  if (!cancellationAllowed || !pickupAt) return false;
  const deadline = cancelByDate(pickupAt, rules);
  return deadline != null && now.getTime() <= deadline.getTime();
}

export function earliestPickup(
  rules: LeadTimeRules,
  now: Date = new Date(),
): Date {
  const days = leadTimeDays(rules.leadTime);
  const dayFloor = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + days,
  );
  dayFloor.setHours(0, 0, 0, 0);
  return dayFloor.getTime() < now.getTime() ? now : dayFloor;
}

function normalizeDay(day: string): string {
  return day.trim().toLowerCase();
}

export function generateFulfillmentSlotIsos(
  windows: FulfillmentWindow[],
  rules: LeadTimeRules,
  now: Date,
  daysAhead = PICKUP_DAYS_AHEAD,
): string[] {
  if (windows.length === 0) return [];
  const leadDays = leadTimeDays(rules.leadTime);
  const cutoff = resolveLeadTimeCutoff(rules.leadTimeCutoff);
  const byDay = new Map(windows.map((w) => [normalizeDay(w.dayOfWeek), w]));
  const slots: string[] = [];

  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    if (!isPickupDayBookable(day, leadDays, cutoff, now)) continue;

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

export function formatOrderLeftLabel(deadline: Date, now: Date): string | null {
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

export type LeadTimeExampleOptions = {
  fulfillmentMode?: "pickup" | "delivery" | "both";
  pickupWindows?: FulfillmentWindow[];
  deliveryWindows?: FulfillmentWindow[];
};

const WEEKDAY_SORT_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function weekdaySortIndex(dayOfWeek: string): number {
  const idx = WEEKDAY_SORT_ORDER.indexOf(
    normalizeDay(dayOfWeek) as (typeof WEEKDAY_SORT_ORDER)[number],
  );
  return idx >= 0 ? idx : 99;
}

function formatWeekday(date: Date): string {
  return date.toLocaleDateString("en-CA", { weekday: "long" });
}

function formatSlotTime(time: string): string {
  const { hours, minutes } = parseCutoffParts(
    time.length === 5 ? `${time}:00` : time,
  );
  const d = new Date(2000, 0, 1, hours, minutes, 0);
  return d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: minutes === 0 ? undefined : "2-digit",
  });
}

function pickExampleWindow(
  options?: LeadTimeExampleOptions,
): { window: FulfillmentWindow; kind: "pickup" | "delivery" } | null {
  if (!options) return null;

  const pickup = options.pickupWindows ?? [];
  const delivery = options.deliveryWindows ?? [];
  const mode = options.fulfillmentMode ?? "pickup";

  let candidates: { window: FulfillmentWindow; kind: "pickup" | "delivery" }[] =
    [];
  if (mode === "pickup") {
    candidates = pickup.map((window) => ({ window, kind: "pickup" }));
  } else if (mode === "delivery") {
    candidates = delivery.map((window) => ({ window, kind: "delivery" }));
  } else {
    const source = pickup.length > 0 ? pickup : delivery;
    const kind = pickup.length > 0 ? "pickup" : "delivery";
    candidates = source.map((window) => ({ window, kind }));
  }

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      weekdaySortIndex(a.window.dayOfWeek) -
      weekdaySortIndex(b.window.dayOfWeek),
  );
  return candidates[0] ?? null;
}

function exampleFulfillmentDay(dayOfWeek: string, leadDays: number): Date {
  const target = DAY_NAMES.indexOf(
    normalizeDay(dayOfWeek) as (typeof DAY_NAMES)[number],
  );
  const anchor = new Date();
  anchor.setHours(12, 0, 0, 0);
  const minOffset = Math.max(leadDays + 1, 1);

  for (let offset = minOffset; offset < minOffset + 14; offset++) {
    const day = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate() + offset,
    );
    if (day.getDay() === target) return day;
  }

  return new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() + 7,
  );
}

function fulfillmentDayLabel(mode?: LeadTimeExampleOptions["fulfillmentMode"]) {
  if (mode === "delivery") return "delivery day";
  if (mode === "both") return "pickup or delivery day";
  return "pickup day";
}

export function leadTimeExampleText(
  leadTime: string,
  cutoffTime: string,
  options?: LeadTimeExampleOptions,
): string {
  const days = leadTimeDays(leadTime);
  const cutoffLabel = formatLeadTimeCutoffLabel(cutoffTime);
  const picked = pickExampleWindow(options);
  const fulfillmentKind =
    picked?.kind ??
    (options?.fulfillmentMode === "delivery" ? "delivery" : "pickup");
  const fulfillmentWord =
    fulfillmentKind === "delivery" ? "delivery" : "pickup";
  const dayLabel = fulfillmentDayLabel(options?.fulfillmentMode);

  if (picked) {
    const fulfillmentDay = exampleFulfillmentDay(picked.window.dayOfWeek, days);
    const fulfillmentDayName = formatWeekday(fulfillmentDay);
    const slotTime = formatSlotTime(picked.window.fromTime);
    const orderBy = orderDeadlineForPickupDay(fulfillmentDay, days, cutoffTime);
    const orderByDayName = formatWeekday(orderBy);
    const cutoffDisplay = cutoffLabel.replace(/\.$/, "");

    return `Example: for ${fulfillmentDayName} ${fulfillmentWord} at ${slotTime}, orders close ${orderByDayName} at ${cutoffDisplay}.`;
  }

  const leadLabel = formatLeadTime(leadTime) ?? `${days} days`;
  if (days === 0) {
    return `Same-day orders close at ${cutoffLabel} on the ${dayLabel}. Add your ${fulfillmentWord} days above to see a concrete example.`;
  }

  return `${leadLabel} before ${fulfillmentWord}. Orders close on the order-by day at ${cutoffLabel}. Add your ${fulfillmentWord} days above to see a concrete example.`;
}

export function formatDbLeadTimeCutoff(value: unknown): string {
  if (value == null) return DEFAULT_LEAD_TIME_CUTOFF;
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}:${String(value.getSeconds()).padStart(2, "0")}`;
  }
  const str = String(value).trim();
  const isoTime = /T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(str);
  if (isoTime) {
    return normalizeLeadTimeCutoff(
      `${isoTime[1]}:${isoTime[2]}:${isoTime[3] ?? "00"}`,
    );
  }
  return normalizeLeadTimeCutoff(str);
}

/** Prefer order snapshots; fall back to live cook profile for legacy orders. */
export function resolveOrderLeadTimeRules(input: {
  leadTimeSnapshot?: string | null;
  leadTimeCutoffSnapshot?: unknown;
  cookLeadTime?: string | null;
  cookLeadTimeCutoff?: unknown;
}): LeadTimeRules {
  return {
    leadTime: input.leadTimeSnapshot ?? input.cookLeadTime ?? null,
    leadTimeCutoff: formatDbLeadTimeCutoff(
      input.leadTimeCutoffSnapshot ?? input.cookLeadTimeCutoff,
    ),
  };
}

export function describeLeadTimePolicy(
  leadTime: string | null,
  leadTimeCutoff?: string | null,
): string | null {
  if (!leadTime) return null;
  const leadLabel = formatLeadTime(leadTime);
  const cutoffLabel = formatLeadTimeCutoffLabel(leadTimeCutoff);
  const days = leadTimeDays(leadTime);
  if (days === 0) {
    return `${leadLabel}, orders close at ${cutoffLabel} on pickup day`;
  }
  return `${leadLabel} notice, orders close at ${cutoffLabel}`;
}

export function describeCancellationPolicy(
  cancellationAllowed: boolean,
  leadTime: string | null,
  leadTimeCutoff?: string | null,
): string {
  if (!cancellationAllowed) return "Final once placed";
  if (!leadTime) return "Free before cook confirms";
  const days = leadTimeDays(leadTime);
  const cutoffLabel = formatLeadTimeCutoffLabel(leadTimeCutoff);
  if (days === 0) return `Free until ${cutoffLabel} on pickup day`;
  const leadLabel = formatLeadTime(leadTime);
  return `Free until ${cutoffLabel}, ${leadLabel} before pickup`;
}

export function orderByDayLabel(
  pickupAt: Date,
  rules: LeadTimeRules,
): { orderBy: Date; pickupDay: Date } {
  const days = leadTimeDays(rules.leadTime);
  const orderBy = orderDeadlineForPickupDay(
    pickupAt,
    days,
    rules.leadTimeCutoff,
  );
  return { orderBy, pickupDay: pickupAt };
}
