// Builds the business calendar week grid. Orders on days that no longer appear
// in the cook's logistics still get a window so snapshotted schedules show up.

export type Fulfillment = "pickup" | "delivery";

export type CalendarOrder = {
  id: string;
  scheduleDay: string;
  datetime: string;
  windowStart: string | null;
  windowEnd: string | null;
  kind: Fulfillment;
  customerName: string;
  listingTitle: string;
  quantity: number;
  pickupCodeVerifiedAt: string | null;
};

export type AvailabilityWindow = {
  weekday: number;
  kind: Fulfillment;
  from: string;
  to: string;
};

export type WindowGroup = {
  window: AvailabilityWindow;
  orders: CalendarOrder[];
};

export type DaySchedule = {
  date: Date;
  windows: WindowGroup[];
};

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

function sameLocalDay(scheduleDay: string, date: Date): boolean {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return scheduleDay === `${y}-${mo}-${day}`;
}

function hmFromDate(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function windowTimesFromOrders(orders: CalendarOrder[]): {
  from: string;
  to: string;
} {
  if (orders.length === 0) return { from: "00:00", to: "23:59" };
  const starts = orders.map((o) =>
    new Date(o.windowStart ?? o.datetime).getTime(),
  );
  const ends = orders.map((o) => new Date(o.windowEnd ?? o.datetime).getTime());
  const min = new Date(Math.min(...starts));
  const max = new Date(Math.max(...ends));
  return { from: hmFromDate(min), to: hmFromDate(max) };
}

export function buildWeekFromData(
  weekStart: Date,
  availability: {
    pickupWindows: Array<{ day: string; from: string; to: string }>;
    deliveryWindows: Array<{ day: string; from: string; to: string }>;
    offersPickup: boolean;
    delivery: string | null;
  },
  orders: CalendarOrder[],
): DaySchedule[] {
  const pickupMap = Object.fromEntries(
    availability.pickupWindows.map((w) => [w.day, { from: w.from, to: w.to }]),
  );
  const deliveryMap = Object.fromEntries(
    availability.deliveryWindows.map((w) => [
      w.day,
      { from: w.from, to: w.to },
    ]),
  );
  const hasPickup = availability.offersPickup !== false;
  const hasDelivery =
    availability.delivery !== "none" && availability.delivery != null;

  const days: DaySchedule[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dayName = DAY_NAMES[date.getDay()] ?? "";
    const pickupWindow = pickupMap[dayName];
    const deliveryWindow = deliveryMap[dayName];
    const windows: WindowGroup[] = [];

    const pickupOrders = orders.filter(
      (o) => o.kind === "pickup" && sameLocalDay(o.scheduleDay, date),
    );
    if (pickupOrders.length > 0 || (hasPickup && pickupWindow)) {
      const times = pickupWindow ?? windowTimesFromOrders(pickupOrders);
      windows.push({
        window: {
          weekday: date.getDay(),
          kind: "pickup",
          from: times.from,
          to: times.to,
        },
        orders: pickupOrders.sort(
          (a, b) =>
            new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
        ),
      });
    }

    const deliveryOrders = orders.filter(
      (o) => o.kind === "delivery" && sameLocalDay(o.scheduleDay, date),
    );
    if (deliveryOrders.length > 0 || (hasDelivery && deliveryWindow)) {
      const times = deliveryWindow ?? windowTimesFromOrders(deliveryOrders);
      windows.push({
        window: {
          weekday: date.getDay(),
          kind: "delivery",
          from: times.from,
          to: times.to,
        },
        orders: deliveryOrders.sort(
          (a, b) =>
            new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
        ),
      });
    }

    days.push({ date, windows });
  }

  return days;
}

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
