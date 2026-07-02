"use client";

import { Landmark, TrendingUp, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import StripeConnectPanel from "@/app/components/StripeConnectPanel";
import { Skeleton } from "../_skeleton";
import styles from "./page.module.css";

type Period = "week" | "month";

type EarningPoint = { label: string; value: number };

type NextPayout = {
  hasAccount: boolean;
  available: number;
  pending: number;
  currency: string;
};

type PayoutStatus = "pending" | "in_transit" | "paid" | "failed" | "cancelled";

type Payout = {
  id: string;
  amount: string;
  currency: string | null;
  status: PayoutStatus;
  arrivalDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: number): string {
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTick(v: number): string {
  if (v === 0) return "$0";
  if (v >= 1000) {
    const k = v / 1000;
    return Number.isInteger(k) ? `$${k}k` : `$${k.toFixed(1)}k`;
  }
  if (Number.isInteger(v)) return `$${v}`;
  return `$${v.toFixed(2)}`;
}

function computeChart(max: number): { ceiling: number; ticks: number[] } {
  const raw = max * 1.15;
  const step = raw <= 6000 ? 2000 : raw <= 20000 ? 5000 : 10000;
  const ceiling = Math.ceil(raw / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= ceiling; v += step) ticks.push(v);
  return { ceiling, ticks };
}

const STATUS_LABEL: Record<PayoutStatus, string> = {
  pending: "Open",
  in_transit: "In transit",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

const BADGE_CLS: Record<PayoutStatus, string> = {
  pending: styles.badgePending,
  in_transit: styles.badgePending,
  paid: styles.badgePaid,
  failed: styles.badgePending,
  cancelled: styles.badgePending,
};

function StatusBadge({ status }: { status: PayoutStatus }) {
  return (
    <span className={`${styles.badge} ${BADGE_CLS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const PAYOUT_PAGE_SIZE = 15;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EarningsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [series, setSeries] = useState<EarningPoint[]>([]);
  const [seriesTotal, setSeriesTotal] = useState(0);
  const [nextPayout, setNextPayout] = useState<NextPayout | null>(null);
  const [loadingNextPayout, setLoadingNextPayout] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutsMeta, setPayoutsMeta] = useState({
    total: 0,
    page: 1,
    limit: PAYOUT_PAGE_SIZE,
  });
  const [loadingChart, setLoadingChart] = useState(true);
  const [loadingPayouts, setLoadingPayouts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadChart = useCallback(async (p: Period) => {
    setLoadingChart(true);
    try {
      const count = p === "week" ? 8 : 12;
      const res = await fetch(
        `/api/business/dashboard/earnings/history?period=${p}&count=${count}`,
      );
      if (res.ok) {
        const json = await res.json();
        setSeries(json.data?.series ?? []);
        setSeriesTotal(json.data?.total ?? 0);
      }
    } finally {
      setLoadingChart(false);
    }
  }, []);

  const loadPayouts = useCallback(async (page: number) => {
    if (page === 1) setLoadingPayouts(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/business/dashboard/payouts?page=${page}&limit=${PAYOUT_PAGE_SIZE}`,
      );
      if (res.ok) {
        const json = await res.json();
        if (page === 1) {
          setPayouts(json.data ?? []);
        } else {
          setPayouts((prev) => [...prev, ...(json.data ?? [])]);
        }
        setPayoutsMeta(
          json.meta ?? { total: 0, page, limit: PAYOUT_PAGE_SIZE },
        );
      }
    } finally {
      setLoadingPayouts(false);
      setLoadingMore(false);
    }
  }, []);

  const loadNextPayout = useCallback(async () => {
    setLoadingNextPayout(true);
    try {
      const res = await fetch("/api/business/dashboard/earnings/next-payout");
      if (res.ok) {
        const json = await res.json();
        setNextPayout(json.data ?? null);
      }
    } finally {
      setLoadingNextPayout(false);
    }
  }, []);

  useEffect(() => {
    loadChart(period);
  }, [period, loadChart]);

  useEffect(() => {
    loadPayouts(1);
  }, [loadPayouts]);

  useEffect(() => {
    loadNextPayout();
  }, [loadNextPayout]);

  const max = series.length > 0 ? Math.max(...series.map((p) => p.value)) : 0;
  const { ceiling, ticks } = computeChart(max || 1);

  const remaining = payoutsMeta.total - payouts.length;

  // A connected-account balance can go negative after refunds/chargebacks; you
  // can't pay out a negative, so the headline floors at zero.
  const availablePayout = Math.max(0, nextPayout?.available ?? 0);

  const hasRevenue = !loadingChart && seriesTotal > 0;

  function handleShowMore() {
    loadPayouts(payoutsMeta.page + 1);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Earnings</h1>
        <p className={styles.tagline}>
          Track your revenue and payouts at a glance.
        </p>
      </div>

      <div className={styles.nextPayoutCard}>
        <div className={styles.nextPayoutIcon} aria-hidden="true">
          <Landmark size={20} />
        </div>
        <div className={styles.nextPayoutBody}>
          <span className={styles.nextPayoutLabel}>Next payout</span>
          {loadingNextPayout ? (
            <>
              <Skeleton
                width={132}
                height={28}
                radius={6}
                style={{ marginTop: 2 }}
              />
              <Skeleton
                width={180}
                height={12}
                radius={6}
                style={{ marginTop: 8 }}
              />
            </>
          ) : !nextPayout?.hasAccount ? (
            <>
              <span className={styles.nextPayoutAmount}>—</span>
              <span className={styles.nextPayoutSub}>
                Connect your payout account to see funds on the way.
              </span>
            </>
          ) : (
            <>
              <span className={styles.nextPayoutAmount}>
                {formatMoney(availablePayout)}
              </span>
              <span className={styles.nextPayoutSub}>
                {availablePayout > 0
                  ? "Available now. Heading to your bank account."
                  : "No funds awaiting payout right now."}
              </span>
              {nextPayout.pending > 0 && (
                <span className={styles.nextPayoutPending}>
                  + {formatMoney(nextPayout.pending)} still settling
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className={styles.stripeSection}>
        <StripeConnectPanel returnTo="/business/earnings" />
      </div>

      <div className={styles.revenueRow}>
        <div className={styles.revenueBlock}>
          <span className={styles.revenueLabel}>
            {period === "week" ? "Last 8 weeks" : "Last 12 months"}
          </span>
          <span className={styles.revenueValue}>
            {loadingChart ? (
              <Skeleton width={108} height={30} radius={6} />
            ) : (
              formatMoney(seriesTotal)
            )}
          </span>
          <span className={styles.revenueSub}>
            <TrendingUp size={13} className={styles.trendIcon} />
            {loadingChart ? (
              <Skeleton width={170} height={12} radius={6} />
            ) : hasRevenue ? (
              `Across the last ${series.length} ${period === "week" ? "weeks" : "months"}`
            ) : (
              "Fulfill orders to see revenue here"
            )}
          </span>
        </div>
        <div className={styles.segControl}>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.segBtn} ${period === p.id ? styles.segBtnActive : ""}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.chartBody}>
          {/* Y-axis labels */}
          <div className={styles.yAxis}>
            {ticks.map((tick) => (
              <span
                key={tick}
                className={styles.yLabel}
                style={{ top: `${((ceiling - tick) / ceiling) * 100}%` }}
              >
                {formatTick(tick)}
              </span>
            ))}
          </div>

          <div className={styles.chartMain}>
            {/* Horizontal grid lines behind bars */}
            <div className={styles.gridLayer} aria-hidden="true">
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className={`${styles.gridLine} ${tick === 0 ? styles.gridBaseline : ""}`}
                  style={{ bottom: `${(tick / ceiling) * 100}%` }}
                />
              ))}
            </div>

            <div className={styles.barsRow}>
              {loadingChart
                ? Array.from({ length: period === "week" ? 8 : 12 }, (_, i) => {
                    const heights = [42, 64, 38, 78, 52, 70, 46, 60];
                    return (
                      // biome-ignore lint/suspicious/noArrayIndexKey: loading skeleton only
                      <div key={i} className={styles.barCol}>
                        <div className={styles.barTrack}>
                          <Skeleton
                            width="100%"
                            height={`${heights[i % heights.length]}%`}
                            style={{
                              maxWidth: 40,
                              borderRadius: "6px 6px 0 0",
                            }}
                          />
                        </div>
                        <Skeleton
                          width={22}
                          height={10}
                          radius={4}
                          style={{ marginTop: 8 }}
                        />
                      </div>
                    );
                  })
                : series.map((p) => (
                    <div key={p.label} className={styles.barCol}>
                      <div className={styles.barTrack}>
                        {p.value > 0 && (
                          <span className={styles.barTip}>
                            {formatMoney(p.value)}
                          </span>
                        )}
                        <div
                          className={`${styles.bar} ${p.value === 0 ? styles.barZero : ""}`}
                          style={{
                            height: `${ceiling > 0 ? (p.value / ceiling) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className={styles.barLabel}>{p.label}</span>
                    </div>
                  ))}
            </div>
            {!loadingChart && !hasRevenue && (
              <div className={styles.chartEmpty}>
                <TrendingUp
                  size={18}
                  className={styles.emptyIcon}
                  aria-hidden
                />
                <p className={styles.emptyTitle}>No earnings yet</p>
                <p className={styles.emptyText}>
                  Revenue from fulfilled orders will chart here week by week.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.payouts}>
        <h2 className={styles.payoutsTitle}>Payout history</h2>
        <div className={styles.payoutList}>
          {loadingPayouts ? (
            [0, 1, 2, 3].map((i) => (
              <div key={i} className={styles.payoutRow} aria-hidden="true">
                <div className={styles.payoutColDate}>
                  <Skeleton width="70%" height={14} radius={6} />
                </div>
                <div className={styles.payoutColBank}>
                  <Skeleton width={48} height={13} radius={6} />
                </div>
                <div className={styles.payoutColAmount}>
                  <Skeleton width={56} height={14} radius={6} />
                  <Skeleton width={48} height={20} radius={10} />
                </div>
              </div>
            ))
          ) : payouts.length === 0 ? (
            <div className={styles.emptyState}>
              <Wallet size={20} className={styles.emptyIcon} aria-hidden />
              <p className={styles.emptyTitle}>No payouts yet</p>
              <p className={styles.emptyText}>
                After orders are fulfilled and funds settle, Stripe transfers
                will show up here.
              </p>
            </div>
          ) : (
            payouts.map((payout) => (
              <div key={payout.id} className={styles.payoutRow}>
                <div className={styles.payoutColDate}>
                  <span className={styles.payoutDateLabel}>
                    Payout for{" "}
                    {formatDate(payout.arrivalDate ?? payout.createdAt)}
                  </span>
                </div>
                <div className={styles.payoutColBank}>
                  <span className={styles.payoutBank}>Stripe</span>
                </div>
                <div className={styles.payoutColAmount}>
                  <span className={styles.payoutAmount}>
                    {formatMoney(Number(payout.amount))}
                  </span>
                  <StatusBadge status={payout.status} />
                </div>
              </div>
            ))
          )}
        </div>
        {remaining > 0 && (
          <button
            type="button"
            className={styles.showMoreBtn}
            onClick={handleShowMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Show more"}
            {!loadingMore && (
              <span className={styles.showMoreCount}>
                {Math.min(remaining, PAYOUT_PAGE_SIZE)}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
