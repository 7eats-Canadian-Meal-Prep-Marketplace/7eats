"use client";

import { CheckCircle, Clock, Package } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MOCK_ORDERS, type OrderStatus } from "../_mock";
import styles from "./page.module.css";

function statusInfo(status: OrderStatus): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "confirmed":
      return {
        label: "Confirmed",
        color: styles.statusConfirmed,
        icon: <Clock size={13} />,
      };
    case "ready":
      return {
        label: "Ready for pickup",
        color: styles.statusReady,
        icon: <Package size={13} />,
      };
    case "completed":
      return {
        label: "Completed",
        color: styles.statusCompleted,
        icon: <CheckCircle size={13} />,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        color: styles.statusCancelled,
        icon: null,
      };
  }
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  const active = MOCK_ORDERS.filter((o) =>
    ["confirmed", "ready"].includes(o.status),
  );
  const past = MOCK_ORDERS.filter((o) =>
    ["completed", "cancelled"].includes(o.status),
  );

  return (
    <div className={styles.page}>
      {success && (
        <div className={styles.successBanner}>
          🎉 Your order has been placed! You'll hear from your cook soon.
        </div>
      )}

      <div className={styles.inner}>
        <h1 className={styles.heading}>Your orders</h1>

        {active.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Active</h2>
            <div className={styles.orderList}>
              {active.map((order) => {
                const info = statusInfo(order.status);
                return (
                  <Link
                    key={order.id}
                    href={`/app/orders/${order.id}`}
                    className={styles.orderCard}
                  >
                    <div
                      className={styles.orderCover}
                      style={{ background: order.listingGradient }}
                    >
                      <span className={styles.orderEmoji}>
                        {order.listingEmoji}
                      </span>
                    </div>
                    <div className={styles.orderBody}>
                      <div className={styles.orderTop}>
                        <span className={styles.cookName}>
                          {order.cookName}
                        </span>
                        <span className={`${styles.statusBadge} ${info.color}`}>
                          {info.icon}
                          {info.label}
                        </span>
                      </div>
                      <h3 className={styles.orderTitle}>
                        {order.listingTitle}
                      </h3>
                      <p className={styles.orderMeta}>
                        📅 {order.pickupDate} · {order.pickupWindow}
                      </p>
                      <div className={styles.orderFooter}>
                        <span className={styles.orderTotal}>
                          ${order.total}.00
                        </span>
                        <span className={styles.pickupCode}>
                          Code:{" "}
                          <strong className={styles.code}>
                            {order.pickupCode}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Past orders</h2>
            <div className={styles.orderList}>
              {past.map((order) => {
                const info = statusInfo(order.status);
                return (
                  <Link
                    key={order.id}
                    href={`/app/orders/${order.id}`}
                    className={`${styles.orderCard} ${styles.orderCardPast}`}
                  >
                    <div
                      className={styles.orderCover}
                      style={{
                        background: order.listingGradient,
                        opacity: 0.7,
                      }}
                    >
                      <span className={styles.orderEmoji}>
                        {order.listingEmoji}
                      </span>
                    </div>
                    <div className={styles.orderBody}>
                      <div className={styles.orderTop}>
                        <span className={styles.cookName}>
                          {order.cookName}
                        </span>
                        <span className={`${styles.statusBadge} ${info.color}`}>
                          {info.icon}
                          {info.label}
                        </span>
                      </div>
                      <h3 className={styles.orderTitle}>
                        {order.listingTitle}
                      </h3>
                      <p className={styles.orderMeta}>📅 {order.pickupDate}</p>
                      <div className={styles.orderFooter}>
                        <span className={styles.orderTotal}>
                          ${order.total}.00
                        </span>
                        <span className={styles.reorderBtn}>Order again →</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {active.length === 0 && past.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Package size={40} />
            </div>
            <h2 className={styles.emptyTitle}>No orders yet</h2>
            <p className={styles.emptyDesc}>
              Your confirmed orders will appear here.
            </p>
            <Link href="/app/browse" className={styles.browseBtn}>
              Browse listings
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersContent />
    </Suspense>
  );
}
