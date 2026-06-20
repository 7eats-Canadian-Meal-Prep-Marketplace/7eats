"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import styles from "../../../checkout/confirmation/page.module.css";

function GuestCancelInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token")?.trim() ?? "";

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [refunded, setRefunded] = useState(false);

  useEffect(() => {
    if (!token) router.replace("/app/cart");
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
              ? "Your payment authorization has been released. You'll receive a confirmation email shortly."
              : "Your order was cancelled. Based on the cook's policy, the payment may not be refundable at this stage."}
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
        <p className={styles.desc}>
          Only pending orders can be cancelled. If the cook has already
          confirmed your time, cancellation may not include a refund.
        </p>
        {message && (
          <p className={styles.desc} role="alert">
            {message}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={status === "loading"}
            onClick={() => void confirmCancel()}
          >
            {status === "loading" ? "Cancelling…" : "Confirm cancellation"}
          </button>
          <Link href="/app/browse" className={styles.secondaryBtn}>
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
