// ─── Types ─────────────────────────────────────────────────────────────────────

export type Fulfillment = "pickup" | "delivery";

// Recurring weekly availability window (mirrors cook_profiles pickup days/window
// + delivery). weekday: 0 = Sun … 6 = Sat. Times are 24h "HH:MM" local.
export type AvailabilityWindow = {
  weekday: number;
  kind: Fulfillment;
  from: string;
  to: string;
};

export type CalendarOrder = {
  id: string;
  datetime: string; // ISO
  kind: Fulfillment;
  customerName: string;
  listingTitle: string;
  quantity: number;
  // Whether the customer's pickup/delivery code has been verified at handoff.
  // This is the moment an order is actually fulfilled.
  codeVerified: boolean;
};

export type WindowGroup = {
  window: AvailabilityWindow;
  orders: CalendarOrder[];
};

export type DaySchedule = {
  date: Date;
  windows: WindowGroup[];
};

// ─── A realistic cook's recurring schedule ──────────────────────────────────────
// Two pickup days a week, and the Saturday pickup day doubles as the one delivery
// day — i.e. some days carry both a pickup and a delivery window.

export const WEEKLY_AVAILABILITY: AvailabilityWindow[] = [
  { weekday: 2, kind: "pickup", from: "18:00", to: "22:00" }, // Tuesday 6–10 PM
  { weekday: 6, kind: "pickup", from: "11:00", to: "14:00" }, // Saturday 11 AM–2 PM
  { weekday: 6, kind: "delivery", from: "15:00", to: "18:00" }, // Saturday 3–6 PM
];

const CUSTOMERS = [
  "Amara Okafor",
  "Liam Chen",
  "Priya Nair",
  "Marcus Reid",
  "Sofia Russo",
  "Kenji Tanaka",
  "Dana White",
  "Hassan Ali",
  "Grace Lin",
  "Noah Park",
  "Aisha Khan",
  "Theo Martin",
  "Emily Zhou",
  "Omar Said",
  "Lena Vogel",
  "Ruby Singh",
];

const LISTINGS = [
  "Weekend West African Feast",
  "Lunch Bento Box",
  "Evening Tikka Bowls",
  "Falafel Wrap Combo",
  "Miso Salmon Dinner",
  "Brunch Flatbread Set",
  "Sunday Suya Platter",
];

// ─── Date helpers ────────────────────────────────────────────────────────────────

// Monday (00:00 local) of the week containing `d`.
export function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function currentWeekStart(): Date {
  return mondayOf(new Date());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatHM(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${h12} ${period}`
    : `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// ─── Deterministic mock generation ───────────────────────────────────────────────
// Orders are derived from a stable hash of (date + window kind) so the same week
// always renders the same data, while different weeks vary naturally.

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function ordersForWindow(date: Date, w: AvailabilityWindow): CalendarOrder[] {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${w.kind}`;
  const seed = hashStr(key);

  // Pickup windows tend to be busier than the single delivery run.
  const cap = w.kind === "delivery" ? 4 : 6;
  const count = seed % (cap + 1); // 0 … cap

  const [fromH, fromM] = w.from.split(":").map(Number);
  const [toH] = w.to.split(":").map(Number);
  const windowMinutes = (toH - fromH) * 60;
  const now = Date.now();

  // For realism, exactly one order per past window is left "not collected" —
  // the cook handed it off without scanning the code (fraud exposure). The
  // rest of a past window is verified; future windows are all awaiting.
  const missedIndex = count > 0 ? seed % count : -1;

  const orders: CalendarOrder[] = [];
  for (let i = 0; i < count; i++) {
    const t = new Date(date);
    const offset = (seed >> (i + 1)) % windowMinutes;
    t.setHours(fromH, fromM + offset, 0, 0);

    const isPast = t.getTime() < now;
    const codeVerified = isPast && i !== missedIndex;

    orders.push({
      id: `${key}-${i}`,
      datetime: t.toISOString(),
      kind: w.kind,
      customerName: CUSTOMERS[(seed + i * 7) % CUSTOMERS.length],
      listingTitle: LISTINGS[(seed + i * 3) % LISTINGS.length],
      quantity: 1 + ((seed >> i) % 2),
      codeVerified,
    });
  }

  return orders.sort((a, b) => a.datetime.localeCompare(b.datetime));
}

// Build Mon→Sun for the week starting at `weekStart`, attaching each day's
// recurring windows and their generated orders.
export function buildWeek(weekStart: Date): DaySchedule[] {
  const days: DaySchedule[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const windows = WEEKLY_AVAILABILITY.filter(
      (w) => w.weekday === date.getDay(),
    ).map((window) => ({ window, orders: ordersForWindow(date, window) }));
    days.push({ date, windows });
  }
  return days;
}
