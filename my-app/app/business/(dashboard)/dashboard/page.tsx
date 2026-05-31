"use client";

import { Calendar, ChevronRight, Inbox, Plus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useHost } from "../_host-context";
import { MOCK_QUEUE, MOCK_STATS, type MockQueueOrder } from "./_mock";
import styles from "./page.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function pickupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrowStr = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).toDateString();
  const time = d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (d.toDateString() === todayStr) return `Today · ${time}`;
  if (d.toDateString() === tomorrowStr) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })} · ${time}`;
}

// ─── Next pickup day logic ─────────────────────────────────────────────────────

function getNextPickupDayOrders(): {
  label: string;
  orders: MockQueueOrder[];
} {
  const confirmed = MOCK_QUEUE.filter((o) => o.status !== "pending");
  if (confirmed.length === 0) return { label: "Today's pickups", orders: [] };

  const dayStart = (iso: string) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const earliest = Math.min(...confirmed.map((o) => dayStart(o.pickupAt)));
  const orders = confirmed
    .filter((o) => dayStart(o.pickupAt) === earliest)
    .sort(
      (a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime(),
    );

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  let label: string;
  if (earliest === now.getTime()) label = "Today's pickups";
  else if (earliest === tomorrow.getTime()) label = "Tomorrow's pickups";
  else {
    const d = new Date(earliest);
    label = `${d.toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" })} pickups`;
  }

  return { label, orders };
}

// ─── Pickup row ───────────────────────────────────────────────────────────────

function PickupRow({ order }: { order: MockQueueOrder }) {
  return (
    <div className={styles.pickupRow}>
      <div className={styles.pickupInfo}>
        <span className={styles.pickupCustomer}>{order.customerName}</span>
        <span className={styles.pickupMeta}>
          {order.listingTitle} &middot; {pickupLabel(order.pickupAt)} &middot;{" "}
          <span className={styles.metaQty}>&times;{order.quantity}</span>
        </span>
      </div>
      <div className={styles.pickupRight}>
        <span className={styles.pickupTotal}>${order.totalPrice}</span>
      </div>
    </div>
  );
}

// ─── Request row ──────────────────────────────────────────────────────────────

function RequestRow({ order }: { order: MockQueueOrder }) {
  return (
    <div className={styles.requestRow}>
      <div className={styles.requestInfo}>
        <span className={styles.requestCustomer}>{order.customerName}</span>
        <span className={styles.requestMeta}>
          {order.listingTitle} &middot; {pickupLabel(order.pickupAt)} &middot;{" "}
          <span className={styles.metaQty}>&times;{order.quantity}</span>
        </span>
      </div>
      <div className={styles.requestRight}>
        <span className={styles.requestTotal}>${order.totalPrice}</span>
        <button type="button" className={styles.confirmBtn}>
          Confirm
        </button>
      </div>
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    href: "/business/listings/new",
    Icon: Plus,
    label: "New listing",
    desc: "Publish a meal for customers to order",
  },
  {
    href: "/business/calendar",
    Icon: Calendar,
    label: "Calendar",
    desc: "See your upcoming pickup schedule",
  },
  {
    href: "/business/inbox",
    Icon: Inbox,
    label: "Inbox",
    desc: "Reply to customer messages",
  },
  {
    href: "/business/earnings",
    Icon: TrendingUp,
    label: "Earnings",
    desc: "Track revenue and payout history",
  },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

const COL_LIMIT = 4;

export default function DashboardPage() {
  const { firstName } = useHost();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [pickupExpanded, setPickupExpanded] = useState(false);
  const [requestsExpanded, setRequestsExpanded] = useState(false);

  const { label: pickupDayLabel, orders: pickupOrders } =
    getNextPickupDayOrders();
  const requests = MOCK_QUEUE.filter((o) => o.status === "pending");

  const visiblePickups = pickupExpanded
    ? pickupOrders
    : pickupOrders.slice(0, COL_LIMIT);
  const visibleRequests = requestsExpanded
    ? requests
    : requests.slice(0, COL_LIMIT);

  return (
    <div className={styles.page}>
      {/* Welcome header */}
      <div className={styles.welcome}>
        <h1 className={styles.welcomeTitle}>
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className={styles.welcomeSub}>
          Here&apos;s a snapshot of your kitchen today.
        </p>
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
                Week
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${period === "month" ? styles.toggleBtnActive : ""}`}
                onClick={() => setPeriod("month")}
              >
                Month
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

      {/* Two columns */}
      <div className={styles.columns}>
        {/* Left: next pickup day */}
        <div className={styles.col}>
          <div className={styles.colHead}>
            <span className={styles.colLabel}>{pickupDayLabel}</span>
            <span className={styles.colCount}>{pickupOrders.length}</span>
          </div>
          <div className={styles.colBody}>
            {pickupOrders.length > 0 ? (
              <>
                {visiblePickups.map((o) => (
                  <PickupRow key={o.id} order={o} />
                ))}
                {!pickupExpanded && pickupOrders.length > COL_LIMIT && (
                  <button
                    type="button"
                    className={styles.viewMore}
                    onClick={() => setPickupExpanded(true)}
                  >
                    View {pickupOrders.length - COL_LIMIT} more
                  </button>
                )}
              </>
            ) : (
              <div className={styles.colEmpty}>No pickups scheduled.</div>
            )}
          </div>
        </div>

        {/* Right: new requests */}
        <div className={styles.col}>
          <div className={styles.colHead}>
            <span className={styles.colLabel}>New requests</span>
            <span className={styles.colCount}>{requests.length}</span>
          </div>
          <div className={styles.colBody}>
            {requests.length > 0 ? (
              <>
                {visibleRequests.map((o) => (
                  <RequestRow key={o.id} order={o} />
                ))}
                {!requestsExpanded && requests.length > COL_LIMIT && (
                  <button
                    type="button"
                    className={styles.viewMore}
                    onClick={() => setRequestsExpanded(true)}
                  >
                    View {requests.length - COL_LIMIT} more
                  </button>
                )}
              </>
            ) : (
              <div className={styles.colEmpty}>No pending requests.</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className={styles.quickSection}>
        <span className={styles.quickLabel}>Quick actions</span>
        <div className={styles.quickGrid}>
          {QUICK_ACTIONS.map(({ href, Icon, label, desc }) => (
            <Link key={href} href={href} className={styles.quickCard}>
              <span className={styles.quickIcon}>
                <Icon size={16} />
              </span>
              <span className={styles.quickText}>
                <span className={styles.quickTitle}>{label}</span>
                <span className={styles.quickDesc}>{desc}</span>
              </span>
              <ChevronRight size={15} className={styles.quickArrow} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
