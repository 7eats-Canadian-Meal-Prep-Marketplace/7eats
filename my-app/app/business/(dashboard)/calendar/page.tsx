"use client";

import { useState } from "react";
import {
  currentWeekStart,
  MOCK_SLOTS,
  type MockSlot,
  type SlotStatus,
} from "./_mock";
import styles from "./page.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const STATUS_LABEL: Record<SlotStatus, string> = {
  open: "Open",
  full: "Full",
  closed: "Closed",
};

const STATUS_CLS: Record<SlotStatus, string> = {
  open: styles.dotOpen,
  full: styles.dotFull,
  closed: styles.dotClosed,
};

// ─── Day column ───────────────────────────────────────────────────────────────

type DayColumn = { name: string; date: Date; slots: MockSlot[] };

function buildColumns(): DayColumn[] {
  const start = currentWeekStart();
  return WEEKDAYS.map((name, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = ymd(date);
    const slots = MOCK_SLOTS.filter((s) => ymd(new Date(s.date)) === key).sort(
      (a, b) => a.date.localeCompare(b.date),
    );
    return { name, date, slots };
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const columns = buildColumns();
  const todayKey = ymd(new Date());
  const selected = MOCK_SLOTS.find((s) => s.id === selectedId) ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Calendar</h1>
        <span className={styles.weekLabel}>
          {columns[0].date.toLocaleDateString("en-CA", {
            month: "short",
            day: "numeric",
          })}{" "}
          –{" "}
          {columns[6].date.toLocaleDateString("en-CA", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      <div className={styles.grid}>
        {columns.map((col) => {
          const key = ymd(col.date);
          const isToday = key === todayKey;
          const isPast = col.date.getTime() < new Date().setHours(0, 0, 0, 0);
          return (
            <div
              key={key}
              className={`${styles.column} ${isPast ? styles.columnPast : ""}`}
            >
              <div
                className={`${styles.dayHead} ${isToday ? styles.dayHeadToday : ""}`}
              >
                <span className={styles.dayName}>{col.name}</span>
                <span className={styles.dayNum}>{col.date.getDate()}</span>
              </div>

              <div className={styles.slotList}>
                {col.slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    className={`${styles.slotCard} ${selectedId === slot.id ? styles.slotCardActive : ""}`}
                    onClick={() => setSelectedId(slot.id)}
                  >
                    <span className={styles.slotTime}>
                      {formatTime(slot.date)}
                    </span>
                    <span className={styles.slotTitle}>
                      {slot.listingTitle}
                    </span>
                    <span className={styles.slotMeta}>
                      <span className={styles.slotStatus}>
                        <span
                          className={`${styles.dot} ${STATUS_CLS[slot.status]}`}
                        />
                        {STATUS_LABEL[slot.status]}
                      </span>
                      <span className={styles.slotCount}>
                        {slot.count} {slot.count === 1 ? "order" : "orders"}
                      </span>
                    </span>
                  </button>
                ))}

                {col.slots.length === 0 && (
                  <span className={styles.emptyDay}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className={styles.detail}>
          <div className={styles.detailHead}>
            <div className={styles.detailHeadMain}>
              <span className={styles.detailTitle}>
                {selected.listingTitle}
              </span>
              <span className={styles.detailMeta}>
                {formatLongDate(selected.date)} · {formatTime(selected.date)}
              </span>
            </div>
            <span className={styles.detailStatus}>
              <span
                className={`${styles.dot} ${STATUS_CLS[selected.status]}`}
              />
              {STATUS_LABEL[selected.status]}
            </span>
          </div>

          <div className={styles.orderList}>
            {selected.orders.length === 0 ? (
              <p className={styles.noOrders}>No orders for this slot yet.</p>
            ) : (
              selected.orders.map((order) => (
                <div key={order.id} className={styles.orderRow}>
                  <span className={styles.orderCustomer}>
                    {order.customerName}
                  </span>
                  <span className={styles.orderQty}>×{order.quantity}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
