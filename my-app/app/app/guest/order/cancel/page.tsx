"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import styles from "../../../checkout/confirmation/page.module.css";

type GuestCancelOrder = {
  cancellable: boolean;
  refundEligible: boolean;
  refundDeadlineLabel: string | null;
  cancelSummary: string;
  cancelDetail: string;
  cancelModalReminder: string;
};

function GuestCancelInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token")?.trim() ?? "";

  const [order, setOrder] = useState<GuestCancelOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [refunded, setRefunded] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace("/app/cart");
      return;
    }

    fetch(`/api/orders/guest?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setMessage(json.error ?? "Could not load this order.");
          return;
        }
        setOrder(json.data as GuestCancelOrder);
      })
      .catch(() => setMessage("Could not load this order."))
      .finally(() => setLoading(false));
  }, [token, router]);

  async function confirmCancel() {
    if (!token) return;
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/orders/guest/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not cancel this order.");
        return;
      }
      setRefunded(Boolean(data.data?.refunded));
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage("Network error — please try again.");
    }
  }

  if (!token) return null;

  if (status === "done") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Order cancelled</h1>
          <p className={styles.desc}>
            {refunded
              ? "Your payment has been released. You'll receive a confirmation email shortly."
              : "Your order was cancelled. Based on the cook's policy, no refund was issued."}
          </p>
          <Link href="/app/browse" className={styles.primaryBtn}>
            Continue browsing
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.desc}>Loading…</p>
      </div>
    );
  }

  if (!order?.cancellable) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Cannot cancel</h1>
          <p className={styles.desc}>
            {message ??
              "This order can no longer be cancelled. It may already be ready or completed."}
          </p>
          <Link href="/app/browse" className={styles.primaryBtn}>
            Continue browsing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Cancel order</h1>
        <p className={styles.desc}>{order.cancelSummary}</p>
        {order.cancelDetail ? (
          <p className={styles.desc}>{order.cancelDetail}</p>
        ) : null}
        {message && (
          <p className={styles.desc} role="alert">
            {message}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={
              order.refundEligible ? styles.primaryBtn : styles.dangerBtn
            }
            disabled={status === "loading"}
            onClick={() => void confirmCancel()}
          >
            {status === "loading"
              ? "Cancelling…"
              : order.refundEligible
                ? "Cancel and refund"
                : "Cancel without refund"}
          </button>
          <Link
            href={`/app/checkout/guest-confirmation?token=${encodeURIComponent(token)}`}
            className={styles.secondaryBtn}
          >
            Keep order
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function GuestCancelPage() {
  return (
    <Suspense fallback={null}>
      <GuestCancelInner />
    </Suspense>
  );
}
