"use client";

import { Bell, CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import styles from "./page.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextWeeklyDates(count = 4): { label: string; day: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + 7 * (i + 1));
    return {
      label: d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
      day: d.toLocaleDateString("en-CA", { weekday: "long" }),
    };
  });
}

type OrderEntry = {
  orderId: string;
  cookName: string;
  fulfillmentMode: "pickup" | "delivery";
  hasSubscription: boolean;
};

// ─── Confirmation inner ───────────────────────────────────────────────────────

function ConfirmationInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isGuest = searchParams.get("guest") === "1";
  const email = searchParams.get("email");
  const count = Number(searchParams.get("count") ?? "0");

  // All hooks must run unconditionally — early return is below
  const orders = useMemo<OrderEntry[]>(() => {
    if (count === 0) return [];
    const entries: OrderEntry[] = [];
    for (let i = 0; i < count; i++) {
      entries.push({
        orderId: searchParams.get(`oid${i}`) ?? `ORD-${i}`,
        cookName: searchParams.get(`cook${i}`) ?? "Your cook",
        fulfillmentMode: (searchParams.get(`mode${i}`) ?? "pickup") as
          | "pickup"
          | "delivery",
        hasSubscription: searchParams.get(`sub${i}`) === "1",
      });
    }
    return entries;
  }, [searchParams, count]);

  // Block direct access — must come from a completed checkout
  useEffect(() => {
    if (count === 0) router.replace("/app/cart");
  }, [count, router]);

  if (count === 0) return null;

  const hasAnySubscription = orders.some((o) => o.hasSubscription);
  const chargeDates = hasAnySubscription ? nextWeeklyDates(4) : [];
  const chargeDay = chargeDates[0]?.day ?? "weekly";

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.iconWrap}>
          <CheckCircle2 size={40} strokeWidth={2} />
        </div>
        <h1 className={styles.title}>You're all set</h1>
        <p className={styles.desc}>
          {isGuest && email ? (
            <>
              Confirmation sent to <strong>{email}</strong>.
            </>
          ) : (
            "Your cook(s) will confirm fulfillment details shortly."
          )}
        </p>

        {/* Per-cook orders */}
        <div className={styles.orderList}>
          {orders.map((o) => (
            <div key={o.orderId} className={styles.orderRow}>
              <div className={styles.orderRowLeft}>
                <span className={styles.cookLabel}>{o.cookName}</span>
                <span className={styles.fulfillmentLabel}>
                  {o.fulfillmentMode === "delivery" ? "Delivery" : "Pickup"}
                  {o.hasSubscription && (
                    <span className={styles.subTag}>
                      <RefreshCw size={10} /> Weekly
                    </span>
                  )}
                </span>
              </div>
              <div className={styles.orderRowRight}>
                <span className={styles.pickupCodeLabel}>Order</span>
                <span className={styles.pickupCode}>
                  {o.orderId.split("-").slice(-1)[0]}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Subscription section */}
        {hasAnySubscription && (
          <>
            <div className={styles.subSection}>
              <div className={styles.subHeader}>
                <RefreshCw size={14} />
                <span>Weekly subscription active</span>
              </div>
              <p className={styles.subNote}>
                Your card will be charged every <strong>{chargeDay}</strong>.
                Here are your upcoming payment dates:
              </p>
              <div className={styles.chargeDates}>
                {chargeDates.map((d) => (
                  <div key={d.label} className={styles.chargeDate}>
                    <span className={styles.chargeDateDay}>
                      {d.day.slice(0, 3)}
                    </span>
                    <span className={styles.chargeDateLabel}>{d.label}</span>
                  </div>
                ))}
              </div>
              <p className={styles.subCancel}>
                Cancel any time from <strong>Account → Subscriptions</strong>.
              </p>
            </div>

            <div className={styles.notifBanner}>
              <Bell size={14} className={styles.notifIcon} />
              <p className={styles.notifText}>
                You'll receive a reminder notification before each weekly{" "}
                {orders.some(
                  (o) => o.hasSubscription && o.fulfillmentMode === "delivery",
                )
                  ? "delivery"
                  : "pickup"}{" "}
                so you're never caught off guard.
              </p>
            </div>
          </>
        )}

        {/* FTC disclosure for subscriptions */}
        {hasAnySubscription && (
          <p className={styles.legalNote}>
            Recurring charges will appear on your card statement every week
            until you cancel. Cancellation takes effect at the end of the
            current billing cycle.
          </p>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          {isGuest ? (
            <>
              <Link href="/app-auth/signup" className={styles.primaryBtn}>
                Create an account
              </Link>
              <p className={styles.hint}>
                Track orders and manage subscriptions.
              </p>
              <Link href="/app/browse" className={styles.secondaryBtn}>
                Continue browsing
              </Link>
            </>
          ) : (
            <>
              <Link href="/app/orders" className={styles.primaryBtn}>
                View your orders
              </Link>
              <Link href="/app/browse" className={styles.secondaryBtn}>
                Continue browsing
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmationInner />
    </Suspense>
  );
}
