"use client";

import Link from "next/link";
import { useState } from "react";
import { MOCK_QUEUE, MOCK_STATS, type MockQueueOrder } from "./_mock";
import styles from "./page.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPickup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  return (
    d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }) +
    ` · ${time}`
  );
}

// ─── Order row ────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: MockQueueOrder }) {
  const isPending = order.status === "pending";
  const isReady = order.status === "ready";
  const href = `/business/orders?focus=${order.id}`;

  return (
    <div className={`${styles.row} ${isPending ? styles.rowPending : ""}`}>
      <Link href={href} className={styles.rowLink}>
        <div className={styles.rowCustomer}>{order.customerName}</div>
        <div className={styles.rowListing}>{order.listingTitle}</div>
        <div className={styles.rowMeta}>
          {formatPickup(order.pickupAt)}&nbsp;&middot;&nbsp;&times;
          {order.quantity}
        </div>
      </Link>
      <div className={styles.rowRight}>
        <span className={styles.rowTotal}>${order.totalPrice}</span>
        {isPending && (
          <button type="button" className={styles.actionBtn}>
            Confirm
          </button>
        )}
        {isReady && <span className={styles.readyTag}>Ready</span>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [period, setPeriod] = useState<"week" | "month">("week");

  const pending = MOCK_QUEUE.filter((o) => o.status === "pending");
  const upcoming = MOCK_QUEUE.filter((o) => o.status !== "pending");

  return (
    <div className={styles.page}>
      {/* Order queue */}
      <div className={styles.queue}>
        {pending.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Needs action</span>
              <span className={styles.badge}>{pending.length}</span>
            </div>
            {pending.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        )}

        {upcoming.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Upcoming</span>
            </div>
            {upcoming.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        )}

        {MOCK_QUEUE.length === 0 && (
          <div className={styles.empty}>
            No orders yet — your queue is clear.
          </div>
        )}

        <Link href="/business/orders" className={styles.viewAll}>
          View all orders →
        </Link>
      </div>

      {/* Stats strip */}
      <div className={styles.statsStrip}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Earnings</span>
            <div className={styles.toggle}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${period === "week" ? styles.toggleBtnActive : ""}`}
                onClick={() => setPeriod("week")}
              >
                Wk
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${period === "month" ? styles.toggleBtnActive : ""}`}
                onClick={() => setPeriod("month")}
              >
                Mo
              </button>
            </div>
          </div>
          <div className={styles.statValue}>
            $
            {period === "week"
              ? MOCK_STATS.earningsWeek
              : MOCK_STATS.earningsMonth}
          </div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pending orders</span>
          <div className={styles.statValue}>{MOCK_STATS.pendingCount}</div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active listings</span>
          <div className={styles.statValue}>{MOCK_STATS.activeListings}</div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Rating</span>
          <div className={styles.statValue}>
            {MOCK_STATS.ratingAverage}
            <span className={styles.statSub}>
              {MOCK_STATS.ratingCount} reviews
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
