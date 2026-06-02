"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import styles from "./page.module.css";

function ConfirmationInner() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order") ?? "ORD-0000";
  const isGuest = searchParams.get("guest") === "1";
  const email = searchParams.get("email");

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <CheckCircle2 size={40} strokeWidth={2} />
        </div>
        <p className={styles.eyebrow}>Order placed</p>
        <h1 className={styles.title}>You're all set</h1>
        <p className={styles.desc}>
          {isGuest && email ? (
            <>
              Confirmation sent to <strong>{email}</strong>. Save your order
              number — you'll need it for pickup.
            </>
          ) : (
            "Your cook will confirm pickup details shortly."
          )}
        </p>

        <div className={styles.orderRef}>
          <span className={styles.orderLabel}>Order number</span>
          <span className={styles.orderId}>{orderId}</span>
        </div>

        <div className={styles.actions}>
          {isGuest ? (
            <>
              <Link href="/app-auth/signup" className={styles.primaryBtn}>
                Create an account
              </Link>
              <p className={styles.hint}>
                Track this order and reorder faster next time.
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
