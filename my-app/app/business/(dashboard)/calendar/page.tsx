"use client";

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Fulfillment = "pickup" | "delivery";

type AvailabilityWindow = {
  weekday: number; // 0=Sun … 6=Sat
  kind: Fulfillment;
  from: string; // "HH:MM"
  to: string;
};

type CalendarOrder = {
  id: string;
  datetime: string;
  kind: Fulfillment;
  customerName: string;
  listingTitle: string;
  quantity: number;
  pickupCodeVerifiedAt: string | null;
};

type WindowGroup = {
  window: AvailabilityWindow;
  orders: CalendarOrder[];
};

type DaySchedule = {
  date: Date;
  windows: WindowGroup[];
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function currentWeekStart(): Date {
  return mondayOf(new Date());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHM(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const h12 = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return (m ?? 0) === 0
    ? `${h12} ${period}`
    : `${h12}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

// ─── Build week from availability + orders ────────────────────────────────────

function buildWeekFromData(
  weekStart: Date,
  availability: {
    pickupWindows: Array<{ day: string; from: string; to: string }>;
    delivery: string | null;
  },
  orders: CalendarOrder[],
): DaySchedule[] {
  const windowMap = Object.fromEntries(
    availability.pickupWindows.map((w) => [w.day, { from: w.from, to: w.to }]),
  );
  const hasDelivery =
    availability.delivery !== "none" && availability.delivery != null;

  const days: DaySchedule[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dayName = DAY_NAMES[date.getDay()] ?? "";
    const dayWindow = windowMap[dayName];

    const windows: WindowGroup[] = [];

    if (dayWindow) {
      const pickupOrders = orders.filter((o) => {
        if (o.kind !== "pickup") return false;
        return sameDay(new Date(o.datetime), date);
      });
      windows.push({
        window: {
          weekday: date.getDay(),
          kind: "pickup",
          from: dayWindow.from,
          to: dayWindow.to,
        },
        orders: pickupOrders.sort(
          (a, b) =>
            new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
        ),
      });

      if (hasDelivery) {
        const deliveryOrders = orders.filter((o) => {
          if (o.kind !== "delivery") return false;
          return sameDay(new Date(o.datetime), date);
        });
        if (deliveryOrders.length > 0) {
          windows.push({
            window: {
              weekday: date.getDay(),
              kind: "delivery",
              from: dayWindow.from,
              to: dayWindow.to,
            },
            orders: deliveryOrders,
          });
        }
      }
    }

    days.push({ date, windows });
  }

  return days;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const KIND_META: Record<
  Fulfillment,
  { label: string; Icon: typeof ShoppingBag }
> = {
  pickup: { label: "Pickup", Icon: ShoppingBag },
  delivery: { label: "Delivery", Icon: Truck },
};

function rangeLabel(start: Date): string {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const s = start.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
  const e = end.toLocaleDateString(
    "en-CA",
    sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" },
  );
  return `${s} – ${e}, ${end.getFullYear()}`;
}

function formatOrderTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

type VerifyState = "verified" | "awaiting" | "missed";

function verifyState(order: CalendarOrder, now: number): VerifyState {
  if (order.pickupCodeVerifiedAt) return "verified";
  return new Date(order.datetime).getTime() < now ? "missed" : "awaiting";
}

const VERIFY_META: Record<
  VerifyState,
  { label: string; Icon: typeof Check; cls: string }
> = {
  verified: { label: "Verified", Icon: Check, cls: styles.verified },
  awaiting: { label: "Awaiting code", Icon: KeyRound, cls: styles.awaiting },
  missed: { label: "Not collected", Icon: AlertTriangle, cls: styles.missed },
};

// ─── Order row ────────────────────────────────────────────────────────────────

function OrderRow({ order, now }: { order: CalendarOrder; now: number }) {
  const { label, Icon, cls } = VERIFY_META[verifyState(order, now)];
  const name = order.customerName || "Customer";
  return (
    <div className={styles.orderRow}>
      <span className={styles.orderTime}>
        {formatOrderTime(order.datetime)}
      </span>
      <span className={styles.orderMain}>
        <span className={styles.orderCustomer}>{name}</span>
        <span className={styles.orderListing}>
          {order.listingTitle ?? "Order"}
        </span>
      </span>
      <span className={styles.orderQty}>×{order.quantity}</span>
      <span className={`${styles.verifyChip} ${cls}`}>
        <Icon size={12} />
        {label}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState<Date>(currentWeekStart());
  const [week, setWeek] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWeek = useCallback(async (ws: Date) => {
    setLoading(true);
    try {
      const dateFrom = toISODateLocal(ws);
      const dateTo = toISODateLocal(addDays(ws, 7));

      const [availRes, ordersRes] = await Promise.all([
        fetch("/api/business/dashboard/availability"),
        fetch(
          `/api/business/dashboard/orders?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=200`,
        ),
      ]);

      const avail = availRes.ok ? (await availRes.json()).data : null;
      const ordersData = ordersRes.ok ? (await ordersRes.json()).data : [];

      const calendarOrders: CalendarOrder[] = (ordersData ?? []).map(
        (o: {
          id: string;
          pickupAt: string;
          customerName: string | null;
          customerFirstName: string | null;
          listingTitle: string | null;
          quantity: number;
          pickupCodeVerifiedAt: string | null;
        }) => ({
          id: o.id,
          datetime: o.pickupAt,
          kind: "pickup" as Fulfillment,
          customerName:
            o.customerName ??
            (o.customerFirstName ? o.customerFirstName : "Customer"),
          listingTitle: o.listingTitle ?? "Order",
          quantity: o.quantity,
          pickupCodeVerifiedAt: o.pickupCodeVerifiedAt,
        }),
      );

      const built = buildWeekFromData(
        ws,
        avail ?? { pickupWindows: [], delivery: null },
        calendarOrders,
      );
      setWeek(built);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeek(weekStart);
  }, [weekStart, loadWeek]);

  const today = new Date();
  const now = today.getTime();
  const isCurrentWeek = sameDay(weekStart, currentWeekStart());
  const activeDays = week.filter((d) => d.windows.length > 0);

  const missedCount = activeDays
    .flatMap((d) => d.windows.flatMap((w) => w.orders))
    .filter((o) => verifyState(o, now) === "missed").length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Calendar</h1>
            <p className={styles.tagline}>
              Your pickup and delivery schedule, week by week.
            </p>
          </div>
          <Link href="/business/settings" className={styles.manageBtn}>
            <SlidersHorizontal size={15} />
            Manage availability
          </Link>
        </div>

        <div className={styles.weekNav}>
          <button
            type="button"
            className={styles.navArrow}
            aria-label="Previous week"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className={styles.todayBtn}
            disabled={isCurrentWeek}
            onClick={() => setWeekStart(currentWeekStart())}
          >
            Today
          </button>
          <button
            type="button"
            className={styles.navArrow}
            aria-label="Next week"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight size={18} />
          </button>
          <span className={styles.rangeLabel}>{rangeLabel(weekStart)}</span>
        </div>
      </div>

      {/* Week ribbon */}
      <div className={styles.weekStrip}>
        {(week.length === 7
          ? week
          : Array.from({ length: 7 }, (_, i) => ({
              date: addDays(weekStart, i),
              windows: [],
            }))
        ).map((day, i) => {
          const isToday = sameDay(day.date, today);
          const isActive = day.windows.length > 0;
          const kinds = new Set(day.windows.map((w) => w.window.kind));
          return (
            <div
              key={day.date.toISOString()}
              className={`${styles.stripCell} ${isActive ? styles.stripActive : ""} ${isToday ? styles.stripToday : ""}`}
            >
              <span className={styles.stripDow}>{WEEKDAYS_SHORT[i]}</span>
              <span className={styles.stripNum}>{day.date.getDate()}</span>
              <span className={styles.stripMarks}>
                {kinds.has("pickup") && (
                  <span className={`${styles.mark} ${styles.markPickup}`} />
                )}
                {kinds.has("delivery") && (
                  <span className={`${styles.mark} ${styles.markDelivery}`} />
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendGroup}>
          <span className={styles.legendItem}>
            <span className={`${styles.mark} ${styles.markPickup}`} />
            Pickup
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.mark} ${styles.markDelivery}`} />
            Delivery
          </span>
        </span>
        <span className={styles.legendDivider} />
        <span className={styles.legendGroup}>
          <span className={styles.legendItem}>
            <Check size={13} className={styles.legendVerified} />
            Verified
          </span>
          <span className={styles.legendItem}>
            <KeyRound size={13} className={styles.legendAwaiting} />
            Awaiting code
          </span>
          <span className={styles.legendItem}>
            <AlertTriangle size={13} className={styles.legendMissed} />
            Not collected
          </span>
        </span>
      </div>

      {/* Fraud disclaimer */}
      {missedCount > 0 && (
        <div className={styles.fraudNote}>
          <AlertTriangle size={15} className={styles.fraudIcon} />
          <span>
            {missedCount} handoff{missedCount === 1 ? "" : "s"} went through
            without a verified code this week. Scanning the customer&apos;s code
            at pickup or delivery confirms the right person collected the order
            — skipping it leaves you exposed to fraud and chargeback disputes.
          </span>
        </div>
      )}

      {/* Agenda */}
      <div className={styles.agenda}>
        {loading ? (
          <div className={styles.empty}>Loading schedule…</div>
        ) : activeDays.length === 0 ? (
          <div className={styles.empty}>
            No pickup or delivery days this week.
          </div>
        ) : (
          activeDays.map((day) => {
            const isToday = sameDay(day.date, today);
            return (
              <section
                key={day.date.toISOString()}
                className={styles.daySection}
              >
                <div
                  className={`${styles.dayHeader} ${isToday ? styles.dayHeaderToday : ""}`}
                >
                  <span className={styles.dayWeekday}>
                    {day.date.toLocaleDateString("en-CA", { weekday: "long" })}
                  </span>
                  <span className={styles.dayDate}>
                    {day.date.toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {day.windows.map(({ window, orders }) => {
                  const { Icon, label } = KIND_META[window.kind];
                  return (
                    <div
                      key={`${window.kind}-${window.from}`}
                      className={`${styles.windowBlock} ${styles[window.kind]}`}
                    >
                      <div className={styles.windowHead}>
                        <span className={styles.windowKind}>
                          <Icon size={14} />
                          {label}
                        </span>
                        <span className={styles.windowTime}>
                          {formatHM(window.from)} – {formatHM(window.to)}
                        </span>
                        <span className={styles.windowCount}>
                          {orders.length}{" "}
                          {orders.length === 1 ? "order" : "orders"}
                        </span>
                      </div>
                      <div className={styles.orderList}>
                        {orders.length === 0 ? (
                          <span className={styles.windowEmpty}>
                            No orders yet.
                          </span>
                        ) : (
                          orders.map((o) => (
                            <OrderRow key={o.id} order={o} now={now} />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
