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
import {
  buildWeekFromData,
  type CalendarOrder,
  type DaySchedule,
  endOfLocalDay,
  type Fulfillment,
  localDateKey,
  startOfLocalDay,
} from "@/lib/business/calendar";
import { Skeleton } from "../_skeleton";
import styles from "./page.module.css";

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

// ΓöÇΓöÇΓöÇ Order row ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Agenda skeleton ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

// Mirrors a day section (header + a window block with a couple of order rows)
// so the agenda holds its shape while the week loads.
function AgendaSkeleton() {
  return (
    <>
      {[0, 1].map((s) => (
        <section key={s} className={styles.daySection} aria-hidden="true">
          <div className={styles.dayHeader}>
            <Skeleton width={84} height={15} radius={6} />
            <Skeleton width={52} height={12} radius={6} />
          </div>
          <div className={`${styles.windowBlock} ${styles.pickup}`}>
            <div className={styles.windowHead}>
              <Skeleton width={70} height={13} radius={6} />
              <Skeleton width={96} height={12} radius={6} />
              <Skeleton width={56} height={12} radius={6} />
            </div>
            <div className={styles.orderList}>
              {[0, 1].map((r) => (
                <div key={r} className={styles.orderRow}>
                  <Skeleton width={52} height={12} radius={6} />
                  <span
                    className={styles.orderMain}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <Skeleton width="55%" height={13} radius={6} />
                    <Skeleton width="40%" height={11} radius={6} />
                  </span>
                  <Skeleton width={28} height={12} radius={6} />
                  <Skeleton width={90} height={22} radius={11} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

// ΓöÇΓöÇΓöÇ Page ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState<Date>(currentWeekStart());
  const [week, setWeek] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWeek = useCallback(async (ws: Date) => {
    setLoading(true);
    try {
      const weekEnd = addDays(ws, 6);
      const dateFrom = startOfLocalDay(ws).toISOString();
      const dateTo = endOfLocalDay(weekEnd).toISOString();

      const [availRes, ordersRes] = await Promise.all([
        fetch("/api/business/dashboard/availability"),
        fetch(
          `/api/business/dashboard/orders?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}&limit=100`,
        ),
      ]);

      if (!ordersRes.ok) {
        console.error(
          "[calendar] orders fetch failed",
          ordersRes.status,
          await ordersRes.text(),
        );
      }

      const avail = availRes.ok ? (await availRes.json()).data : null;
      const ordersData = ordersRes.ok ? (await ordersRes.json()).data : [];

      const calendarOrders: CalendarOrder[] = (
        (ordersData ?? []) as Array<{
          id: string;
          status: string;
          pickupAt: string | null;
          fulfillmentWindowStart: string | null;
          fulfillmentWindowEnd: string | null;
          fulfillmentMode: "pickup" | "delivery" | null;
          customerName: string | null;
          customerFirstName: string | null;
          listingTitle: string | null;
          quantity: number;
          itemCount: number;
          pickupCodeVerifiedAt: string | null;
        }>
      )
        // A cancelled order has no handoff — keep it off the schedule.
        .filter((o) => o.status !== "cancelled")
        .map((o) => {
          const scheduleIso = o.fulfillmentWindowStart ?? o.pickupAt;
          if (!scheduleIso) return null;
          const displayIso =
            o.pickupAt ?? o.fulfillmentWindowStart ?? scheduleIso;
          return {
            id: o.id,
            scheduleDay: localDateKey(new Date(scheduleIso)),
            datetime: displayIso,
            windowStart: o.fulfillmentWindowStart,
            windowEnd: o.fulfillmentWindowEnd,
            kind: (o.fulfillmentMode === "delivery"
              ? "delivery"
              : "pickup") as Fulfillment,
            customerName:
              o.customerName ??
              (o.customerFirstName ? o.customerFirstName : "Customer"),
            listingTitle: o.listingTitle ?? "Order",
            quantity: o.itemCount || o.quantity || 0,
            pickupCodeVerifiedAt: o.pickupCodeVerifiedAt,
          };
        })
        .filter((o): o is CalendarOrder => o !== null);

      const built = buildWeekFromData(
        ws,
        avail ?? {
          pickupWindows: [],
          deliveryWindows: [],
          offersPickup: true,
          delivery: null,
        },
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
          <Link
            href="/business/settings#logistics"
            className={styles.manageBtn}
          >
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
            at pickup or delivery confirms the right person collected the order.
            Skipping it leaves you exposed to fraud and chargeback disputes.
          </span>
        </div>
      )}

      {/* Agenda */}
      <div className={styles.agenda}>
        {loading ? (
          <AgendaSkeleton />
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
