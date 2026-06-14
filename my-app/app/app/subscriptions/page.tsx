"use client";

import { Calendar, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  INTERVAL_LABELS,
  type SubscriptionInterval,
} from "@/lib/subscription-schedule";
import styles from "./page.module.css";

type SubscriptionStatus = "active" | "paused" | "cancelled" | "past_due";

type ApiSubscription = {
  id: string;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  createdAt: string;
  listing: { id: string; title: string };
  tier: { id: string; interval: SubscriptionInterval; price: string };
  cookDisplayName: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusInfo(sub: ApiSubscription): { label: string; color: string } {
  if (sub.status === "cancelled") {
    return { label: "Cancelled", color: styles.statusCancelled };
  }
  if (sub.status === "past_due") {
    return { label: "Payment issue", color: styles.statusPastDue };
  }
  if (sub.cancelAtPeriodEnd) {
    return { label: "Cancels at period end", color: styles.statusPending };
  }
  if (sub.status === "paused") {
    return { label: "Paused", color: styles.statusPending };
  }
  return { label: "Active", color: styles.statusActive };
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subs, setSubs] = useState<ApiSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/subscriptions")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/app-auth/login");
          return null;
        }
        return r.json();
      })
      .then((json) => {
        if (json) setSubs(json.data ?? []);
      })
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCancel(id: string) {
    if (
      !window.confirm(
        "Cancel this subscription at the end of the current billing period?",
      )
    ) {
      return;
    }
    setCancellingId(id);
    setError("");
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to cancel subscription.");
      }
      setSubs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...json.data } : s)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel subscription.",
      );
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <h1 className={styles.heading}>Your subscriptions</h1>
          <p className={styles.loading}>Loading your subscriptions…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>Your subscriptions</h1>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {subs.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <RefreshCw size={32} />
            </div>
            <h2 className={styles.emptyTitle}>No subscriptions yet</h2>
            <p className={styles.emptyDesc}>
              Subscribe to a listing to get repeat orders automatically.
            </p>
            <Link href="/app/browse" className={styles.browseBtn}>
              Browse listings
            </Link>
          </div>
        ) : (
          <div className={styles.list}>
            {subs.map((sub) => {
              const info = statusInfo(sub);
              const canCancel =
                sub.status === "active" && !sub.cancelAtPeriodEnd;
              return (
                <div key={sub.id} className={styles.card}>
                  <div className={styles.cardMain}>
                    <span className={styles.cookName}>
                      {sub.cookDisplayName ?? "Unknown cook"}
                    </span>
                    <Link
                      href={`/app/listings/${sub.listing.id}`}
                      className={styles.listingTitle}
                    >
                      {sub.listing.title}
                    </Link>
                    <div className={styles.meta}>
                      <span className={styles.intervalTag}>
                        <RefreshCw size={11} />
                        {INTERVAL_LABELS[sub.tier.interval]}
                      </span>
                      <span className={styles.price}>
                        ${Number.parseFloat(sub.tier.price).toFixed(2)} /
                        portion
                      </span>
                    </div>
                    {sub.currentPeriodEnd && sub.status !== "cancelled" && (
                      <p className={styles.nextBilling}>
                        <Calendar size={12} />
                        {sub.cancelAtPeriodEnd ? "Ends" : "Next billing"}{" "}
                        {formatDate(sub.currentPeriodEnd)}
                      </p>
                    )}
                  </div>
                  <div className={styles.cardRight}>
                    <span className={`${styles.statusBadge} ${info.color}`}>
                      {info.label}
                    </span>
                    {canCancel && (
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() => handleCancel(sub.id)}
                        disabled={cancellingId === sub.id}
                      >
                        {cancellingId === sub.id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
