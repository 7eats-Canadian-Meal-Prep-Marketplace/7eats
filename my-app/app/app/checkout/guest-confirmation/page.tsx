"use client";

import { CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { formatCartMoney } from "../../cart/_cart-tax";
import styles from "../confirmation/page.module.css";

type GuestOrder = {
  id: string;
  confirmationCode: string;
  status: string;
  totalPrice: string;
  currency: string;
  fulfillmentMode: string | null;
  cookName: string;
  dishes: { dishName: string; quantity: number; lineTotal: string }[];
};

function GuestConfirmationInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token")?.trim() ?? "";

  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace("/app/cart");
      return;
    }

    fetch(`/api/orders/guest?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Could not load your receipt.");
          return;
        }
        setOrder(json.data as GuestOrder);
      })
      .catch(() => setError("Could not load your receipt."))
      .finally(() => setLoading(false));
  }, [token, router]);

  if (!token) return null;

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.desc}>Loading your receipt…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Receipt unavailable</h1>
          <p className={styles.desc}>
            {error ?? "This link may have expired."} Check your email for your
            confirmation code and receipt link.
          </p>
          <Link href="/app/browse" className={styles.primaryBtn}>
            Continue browsing
          </Link>
        </div>
      </div>
    );
  }

  const fulfillmentLabel =
    order.fulfillmentMode === "delivery" ? "Delivery" : "Pickup";

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <CheckCircle2 size={40} strokeWidth={2} />
        </div>
        <h1 className={styles.title}>Order confirmed</h1>
        <p className={styles.desc}>
          Confirmation sent to your email. Save code{" "}
          <strong>{order.confirmationCode}</strong> for support.
        </p>

        <div className={styles.orderList}>
          <div className={styles.orderRow}>
            <div className={styles.orderRowLeft}>
              <span className={styles.cookLabel}>{order.cookName}</span>
              <span className={styles.fulfillmentLabel}>
                {fulfillmentLabel}
              </span>
            </div>
            <span className={styles.orderRef}>{order.confirmationCode}</span>
          </div>
          {order.dishes.map((d) => (
            <div key={d.dishName} className={styles.orderRow}>
              <span className={styles.cookLabel}>
                {d.quantity}× {d.dishName}
              </span>
              <span className={styles.orderRef}>
                ${formatCartMoney(Number.parseFloat(d.lineTotal))}
              </span>
            </div>
          ))}
        </div>

        <p className={styles.desc}>
          Total: ${formatCartMoney(Number.parseFloat(order.totalPrice))}{" "}
          {order.currency}
        </p>

        <div className={styles.notifBanner}>
          <Mail size={14} className={styles.notifIcon} aria-hidden />
          <p className={styles.notifText}>
            The cook will confirm your exact {fulfillmentLabel.toLowerCase()}{" "}
            time by email. Your receipt and cancel link are in your inbox — no
            account needed.
          </p>
        </div>

        <div className={styles.actions}>
          <Link href="/app-auth/signup" className={styles.primaryBtn}>
            Create an account
          </Link>
          <p className={styles.hint}>
            Save your address and pay faster next time.
          </p>
          <Link href="/app/browse" className={styles.secondaryBtn}>
            Continue browsing
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function GuestConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <GuestConfirmationInner />
    </Suspense>
  );
}
