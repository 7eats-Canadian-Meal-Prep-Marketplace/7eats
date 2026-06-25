"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Skeleton } from "../../_skeleton";
import { formatCartMoney } from "../../cart/_cart-tax";
import styles from "./page.module.css";

type GuestOrder = {
  id: string;
  confirmationCode: string;
  status: string;
  subtotal: string;
  deliveryFee: string | null;
  taxAmount: string | null;
  taxLabel: string | null;
  totalPrice: string;
  currency: string;
  fulfillmentMode: string | null;
  timingLabel: string;
  cancellationAllowed: boolean;
  cancellable: boolean;
  refundEligible: boolean;
  refundDeadlineLabel: string | null;
  cancelSummary: string;
  cancelDetail: string;
  ownerHasAccount: boolean;
  cookName: string;
  dishes: { dishName: string; quantity: number; lineTotal: string }[];
};

function parseAmount(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: string | null | undefined): string {
  return formatCartMoney(parseAmount(value));
}

/** Prefer line-item sum; fall back to order fields or total minus tax/fees. */
function receiptTotals(order: GuestOrder) {
  const fromLines = order.dishes.reduce(
    (sum, d) => sum + parseAmount(d.lineTotal),
    0,
  );
  const subtotal = fromLines > 0 ? fromLines : parseAmount(order.subtotal);
  const tax = parseAmount(order.taxAmount);
  const total = parseAmount(order.totalPrice);
  let delivery = parseAmount(order.deliveryFee);
  if (
    order.fulfillmentMode === "delivery" &&
    delivery <= 0 &&
    subtotal > 0 &&
    total > 0
  ) {
    delivery = Math.max(0, Math.round((total - tax - subtotal) * 100) / 100);
  }
  return { subtotal, delivery, tax, total };
}

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
        <div className={styles.card} aria-busy="true">
          <div className={styles.iconWrap}>
            <Skeleton circle width={36} height={36} />
          </div>
          <Skeleton
            width={200}
            height={24}
            radius={8}
            style={{ margin: "16px auto 0" }}
          />
          <Skeleton
            width="80%"
            height={14}
            radius={6}
            style={{ margin: "12px auto 0" }}
          />
          <div className={styles.codeBlock}>
            <Skeleton width={120} height={12} radius={6} />
            <Skeleton
              width={160}
              height={22}
              radius={6}
              style={{ marginTop: 10 }}
            />
          </div>
          <section className={styles.summary}>
            <div className={styles.summaryHead}>
              <Skeleton width={140} height={15} radius={6} />
              <Skeleton width={100} height={13} radius={6} />
            </div>
            <ul className={styles.itemList}>
              {[0, 1].map((i) => (
                <li key={i} className={styles.itemRow}>
                  <Skeleton width={160} height={14} radius={6} />
                  <Skeleton width={48} height={14} radius={6} />
                </li>
              ))}
            </ul>
          </section>
        </div>
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
          <div className={styles.actions}>
            <Link href="/app/browse" className={styles.primaryBtn}>
              Continue browsing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fulfillmentLabel =
    order.fulfillmentMode === "delivery" ? "Delivery" : "Pickup";
  const { subtotal, delivery, tax, total } = receiptTotals(order);
  const cancelHref = `/app/guest/order/cancel?token=${encodeURIComponent(token)}`;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <CheckCircle2 size={36} strokeWidth={2} aria-hidden />
        </div>
        <h1 className={styles.title}>Order confirmed</h1>
        <p className={styles.lead}>
          We sent a receipt to your email. Save your confirmation code below in
          case you need support.
        </p>

        <div className={styles.codeBlock}>
          <p className={styles.codeEyebrow}>Confirmation code</p>
          <p className={styles.codeValue}>{order.confirmationCode}</p>
          <p className={styles.codeHint}>
            Quote this if you contact 7eats support
          </p>
        </div>

        <section className={styles.summary} aria-label="Order summary">
          <div className={styles.summaryHead}>
            <span className={styles.cookName}>{order.cookName}</span>
            <span className={styles.fulfillment}>
              {fulfillmentLabel} · {order.timingLabel}
            </span>
          </div>

          <ul className={styles.itemList}>
            {order.dishes.map((d) => (
              <li
                key={`${d.dishName}-${d.quantity}`}
                className={styles.itemRow}
              >
                <span className={styles.itemName}>
                  {d.quantity}× {d.dishName}
                </span>
                <span className={styles.itemPrice}>${money(d.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <div className={styles.totals}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Subtotal</span>
              <span className={styles.totalValue}>
                ${formatCartMoney(subtotal)}
              </span>
            </div>
            {order.fulfillmentMode === "delivery" && (
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Delivery</span>
                <span className={styles.totalValue}>
                  {delivery > 0 ? `$${formatCartMoney(delivery)}` : "Free"}
                </span>
              </div>
            )}
            {tax > 0 && (
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>
                  {order.taxLabel ?? "Tax"}
                </span>
                <span className={styles.totalValue}>
                  ${formatCartMoney(tax)}
                </span>
              </div>
            )}
            <div className={`${styles.totalRow} ${styles.grandTotal}`}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>
                ${formatCartMoney(total)} {order.currency}
              </span>
            </div>
          </div>
        </section>

        <p className={styles.note}>
          Check your inbox for order updates. You can use this page anytime with
          the link from your email.
        </p>

        <div className={styles.actions}>
          <Link href="/app/browse" className={styles.primaryBtn}>
            Continue browsing
          </Link>
          {!order.ownerHasAccount && (
            <>
              <Link href="/app-auth/signup" className={styles.secondaryBtn}>
                Create an account
              </Link>
              <p className={styles.signupHint}>
                Save your address and pay faster next time.
              </p>
            </>
          )}
          {order.cancellable && (
            <>
              <p className={styles.cancelHint}>
                {order.cancelSummary}
                {order.cancelDetail ? ` ${order.cancelDetail}` : ""}
              </p>
              <Link href={cancelHref} className={styles.textLink}>
                Cancel this order
              </Link>
            </>
          )}
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
