"use client";

import { TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  MOCK_MONTHLY,
  MOCK_PAYOUTS,
  MOCK_TOTAL_REVENUE,
  MOCK_WEEKLY,
  type MockPayout,
  type PayoutStatus,
} from "./_mock";
import styles from "./page.module.css";

type Period = "week" | "month";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: number): string {
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTick(v: number): string {
  if (v === 0) return "$0";
  if (v >= 1000) return `$${v / 1000}k`;
  return `$${v}`;
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
  pending: "Pending",
  paid: "Paid",
};

const BADGE_CLS: Record<PayoutStatus, string> = {
  pending: styles.badgePending,
  paid: styles.badgePaid,
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
  const [visibleCount, setVisibleCount] = useState(PAYOUT_PAGE_SIZE);

  const series = period === "week" ? MOCK_WEEKLY : MOCK_MONTHLY;
  const max = Math.max(...series.map((p) => p.value));
  const periodTotal = series.reduce((sum, p) => sum + p.value, 0);
  const { ceiling, ticks } = computeChart(max);

  const visiblePayouts = MOCK_PAYOUTS.slice(0, visibleCount);
  const remaining = MOCK_PAYOUTS.length - visiblePayouts.length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Earnings</h1>
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

      <div className={styles.revenueBlock}>
        <span className={styles.revenueLabel}>Total revenue</span>
        <span className={styles.revenueValue}>
          {formatMoney(MOCK_TOTAL_REVENUE)}
        </span>
        <span className={styles.revenueSub}>
          <TrendingUp size={13} className={styles.trendIcon} />
          {formatMoney(periodTotal)} over the last {series.length}{" "}
          {period === "week" ? "weeks" : "months"}
        </span>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.chartBody}>
          {/* Y-axis labels, height matches barTrack */}
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
            {/* Horizontal grid lines behind the bars */}
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
              {series.map((p) => (
                <div key={p.label} className={styles.barCol}>
                  <div className={styles.barTrack}>
                    <span className={styles.barTip}>
                      {formatMoney(p.value)}
                    </span>
                    <div
                      className={styles.bar}
                      style={{ height: `${(p.value / ceiling) * 100}%` }}
                    />
                  </div>
                  <span className={styles.barLabel}>{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.payouts}>
        <h2 className={styles.payoutsTitle}>Payout history</h2>
        <div className={styles.payoutList}>
          {visiblePayouts.map((payout: MockPayout) => (
            <div key={payout.id} className={styles.payoutRow}>
              <div className={styles.payoutColDate}>
                <span className={styles.payoutDateLabel}>
                  Payout for {formatDate(payout.date)}
                </span>
              </div>
              <div className={styles.payoutColBank}>
                <span className={styles.payoutBank}>{payout.account}</span>
              </div>
              <div className={styles.payoutColAmount}>
                <span className={styles.payoutAmount}>
                  {formatMoney(payout.amount)}
                </span>
                <StatusBadge status={payout.status} />
              </div>
            </div>
          ))}
        </div>
        {remaining > 0 && (
          <button
            type="button"
            className={styles.showMoreBtn}
            onClick={() => setVisibleCount((c) => c + PAYOUT_PAGE_SIZE)}
          >
            Show more
            <span className={styles.showMoreCount}>
              {Math.min(remaining, PAYOUT_PAGE_SIZE)}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
