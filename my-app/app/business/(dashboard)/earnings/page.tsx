"use client";

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
  { id: "week", label: "Wk" },
  { id: "month", label: "Mo" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EarningsPage() {
  const [period, setPeriod] = useState<Period>("week");

  const series = period === "week" ? MOCK_WEEKLY : MOCK_MONTHLY;
  const max = Math.max(...series.map((p) => p.value));
  const periodTotal = series.reduce((sum, p) => sum + p.value, 0);

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
          {formatMoney(periodTotal)} over the last {series.length}{" "}
          {period === "week" ? "weeks" : "months"}
        </span>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.chart}>
          {series.map((p) => (
            <div key={p.label} className={styles.barCol}>
              <div className={styles.barTrack}>
                <span className={styles.barTip}>{formatMoney(p.value)}</span>
                <div
                  className={styles.bar}
                  style={{ height: `${(p.value / max) * 100}%` }}
                />
              </div>
              <span className={styles.barLabel}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.payouts}>
        <h2 className={styles.payoutsTitle}>Payout history</h2>
        <div className={styles.payoutList}>
          {MOCK_PAYOUTS.map((payout: MockPayout) => (
            <div key={payout.id} className={styles.payoutRow}>
              <span className={styles.payoutDate}>
                {formatDate(payout.date)}
              </span>
              <div className={styles.payoutRight}>
                <span className={styles.payoutAmount}>
                  {formatMoney(payout.amount)}
                </span>
                <StatusBadge status={payout.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
