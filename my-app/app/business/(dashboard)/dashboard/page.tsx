"use client";

import { Calendar, ChevronRight, Plus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useHost } from "../_host-context";
import { Skeleton } from "../_skeleton";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "pending" | "confirmed" | "ready";

type QueueOrder = {
  id: string;
  status: OrderStatus;
  customerName: string | null;
  customerFirstName: string | null;
  listingTitle: string | null;
  quantity: number;
  totalPrice: string;
  pickupAt: string;
  notes: string | null;
};

type DashboardStats = {
  orders: {
    pending: number;
    confirmed: number;
    ready: number;
    fulfilledThisMonth: number;
    fulfilledAllTime: number;
  };
  earnings: {
    thisWeek: number;
    thisMonth: number;
    allTime: number;
    pending: number;
  };
  listings: { active: number };
  meals: { active: number };
  rating: { average: number | null; count: number };
};

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

function displayName(order: QueueOrder): string {
  if (order.customerFirstName) return order.customerFirstName;
  if (order.customerName)
    return order.customerName.split(" ")[0] ?? order.customerName;
  return "Customer";
}

function formatMoney(cents: number): string {
  return cents.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Next pickup day logic ─────────────────────────────────────────────────────

function getNextPickupDayOrders(orders: QueueOrder[]): {
  label: string;
  orders: QueueOrder[];
} {
  const confirmed = orders.filter((o) => o.status !== "pending");
  if (confirmed.length === 0) return { label: "Today's pickups", orders: [] };

  const dayStart = (iso: string) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const earliest = Math.min(...confirmed.map((o) => dayStart(o.pickupAt)));
  const dayOrders = confirmed
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

  return { label, orders: dayOrders };
}

// ─── Pickup row ───────────────────────────────────────────────────────────────

function PickupRow({ order }: { order: QueueOrder }) {
  return (
    <div className={styles.pickupRow}>
      <div className={styles.pickupInfo}>
        <span className={styles.pickupCustomer}>{displayName(order)}</span>
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

function RequestRow({
  order,
  onConfirm,
}: {
  order: QueueOrder;
  onConfirm: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch(
        `/api/business/dashboard/orders/${order.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "confirmed" }),
        },
      );
      if (res.ok) onConfirm(order.id);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className={styles.requestRow}>
      <div className={styles.requestInfo}>
        <span className={styles.requestCustomer}>{displayName(order)}</span>
        <span className={styles.requestMeta}>
          {order.listingTitle} &middot; {pickupLabel(order.pickupAt)} &middot;{" "}
          <span className={styles.metaQty}>&times;{order.quantity}</span>
        </span>
      </div>
      <div className={styles.requestRight}>
        <span className={styles.requestTotal}>${order.totalPrice}</span>
        <button
          type="button"
          className={styles.confirmBtn}
          onClick={handleConfirm}
          disabled={confirming}
        >
          {confirming ? "..." : "Confirm"}
        </button>
      </div>
    </div>
  );
}

// ─── Column skeleton ──────────────────────────────────────────────────────────

// Mirrors the two-line row used by PickupRow/RequestRow so the loading state
// keeps the column's shape instead of collapsing to a "Loading…" line.
function ColRowSkeleton() {
  return (
    <div className={styles.pickupRow} aria-hidden="true">
      <div
        className={styles.pickupInfo}
        style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}
      >
        <Skeleton width="45%" height={13} radius={6} />
        <Skeleton width="70%" height={11} radius={6} />
      </div>
      <Skeleton width={52} height={14} radius={6} />
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    href: "/business/listings/dishes/new",
    Icon: Plus,
    label: "New meal",
    desc: "Publish a meal for customers to order",
  },
  {
    href: "/business/calendar",
    Icon: Calendar,
    label: "Calendar",
    desc: "See your upcoming pickup schedule",
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

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queueOrders, setQueueOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        fetch("/api/business/dashboard/stats"),
        fetch("/api/business/dashboard/orders/upcoming"),
      ]);
      if (statsRes.ok) {
        const json = await statsRes.json();
        setStats(json.data);
      }
      if (ordersRes.ok) {
        const json = await ordersRes.json();
        setQueueOrders(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleConfirm(id: string) {
    setQueueOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, status: "confirmed" as const } : o,
      ),
    );
  }

  const { label: pickupDayLabel, orders: pickupOrders } =
    getNextPickupDayOrders(queueOrders);
  const requests = queueOrders.filter((o) => o.status === "pending");

  const visiblePickups = pickupExpanded
    ? pickupOrders
    : pickupOrders.slice(0, COL_LIMIT);
  const visibleRequests = requestsExpanded
    ? requests
    : requests.slice(0, COL_LIMIT);

  const earningsWeek = stats ? formatMoney(stats.earnings.thisWeek) : "—";
  const earningsMonth = stats ? formatMoney(stats.earnings.thisMonth) : "—";
  const pendingCount = stats?.orders.pending ?? 0;
  const activeMeals = stats?.meals?.active ?? stats?.listings.active ?? 0;
  const ratingAvg = stats?.rating.average;
  const ratingCount = stats?.rating.count ?? 0;

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
            {loading ? (
              <Skeleton width={96} height={26} radius={6} />
            ) : (
              `$${period === "week" ? earningsWeek : earningsMonth}`
            )}
          </div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pending orders</span>
          <div className={styles.statValue}>
            {loading ? (
              <Skeleton width={40} height={26} radius={6} />
            ) : (
              pendingCount
            )}
          </div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active meals</span>
          <div className={styles.statValue}>
            {loading ? (
              <Skeleton width={40} height={26} radius={6} />
            ) : (
              activeMeals
            )}
          </div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Rating</span>
          <div className={styles.statValue}>
            {loading ? (
              <Skeleton width={52} height={26} radius={6} />
            ) : ratingAvg != null ? (
              ratingAvg.toFixed(1)
            ) : (
              "—"
            )}
            {!loading && ratingAvg != null && (
              <span className={styles.statSub}>{ratingCount} reviews</span>
            )}
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
            ) : loading ? (
              <>
                <ColRowSkeleton />
                <ColRowSkeleton />
                <ColRowSkeleton />
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
                  <RequestRow key={o.id} order={o} onConfirm={handleConfirm} />
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
            ) : loading ? (
              <>
                <ColRowSkeleton />
                <ColRowSkeleton />
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
