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
import { useState } from "react";
import {
  addDays,
  buildWeek,
  type CalendarOrder,
  currentWeekStart,
  type Fulfillment,
  formatHM,
  sameDay,
} from "./_mock";
import styles from "./page.module.css";

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

// ─── Verification state ──────────────────────────────────────────────────────
// verified = code scanned at handoff. awaiting = still upcoming, code not due
// yet (normal). missed = handoff time has passed but the code was never
// collected — the cook fulfilled without verifying, which is the fraud risk.

type VerifyState = "verified" | "awaiting" | "missed";

function verifyState(order: CalendarOrder, now: number): VerifyState {
  if (order.codeVerified) return "verified";
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

// ─── Order row ──────────────────────────────────────────────────────────────────

function OrderRow({ order, now }: { order: CalendarOrder; now: number }) {
  const { label, Icon, cls } = VERIFY_META[verifyState(order, now)];
  return (
    <div className={styles.orderRow}>
      <span className={styles.orderTime}>
        {formatOrderTime(order.datetime)}
      </span>
      <span className={styles.orderMain}>
        <span className={styles.orderCustomer}>{order.customerName}</span>
        <span className={styles.orderListing}>{order.listingTitle}</span>
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

  const today = new Date();
  const now = today.getTime();
  const week = buildWeek(weekStart);
  const isCurrentWeek = sameDay(weekStart, currentWeekStart());
  const activeDays = week.filter((d) => d.windows.length > 0);

  const missedCount = activeDays
    .flatMap((d) => d.windows.flatMap((w) => w.orders))
    .filter((o) => verifyState(o, now) === "missed").length;

  return (
    <div className={styles.page}>
      {/* ─── A: navigable header ─── */}
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

      {/* ─── Week ribbon (at-a-glance rhythm) ─── */}
      <div className={styles.weekStrip}>
        {week.map((day, i) => {
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

      {/* ─── Legend ─── */}
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

      {/* ─── Fraud disclaimer (only when codes were missed) ─── */}
      {missedCount > 0 && (
        <div className={styles.fraudNote}>
          <AlertTriangle size={15} className={styles.fraudIcon} />
          <span>
            {missedCount} handoff{missedCount === 1 ? "" : "s"} went through
            without a verified code this week. Scanning the customer's code at
            pickup or delivery confirms the right person collected the order —
            skipping it leaves you exposed to fraud and chargeback disputes.
          </span>
        </div>
      )}

      {/* ─── Agenda ─── */}
      <div className={styles.agenda}>
        {activeDays.length === 0 ? (
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
