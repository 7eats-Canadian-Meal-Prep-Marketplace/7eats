"use client";

import { Package, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MOCK_ORDERS, type MockOrder } from "../_mock";
import styles from "./page.module.css";

function statusInfo(order: MockOrder): { label: string; color: string } {
  switch (order.status) {
    case "pending":
      return { label: "Pending", color: styles.statusPending };
    case "confirmed":
      return { label: "Preparing", color: styles.statusConfirmed };
    case "ready":
      return {
        label:
          order.fulfillmentMode === "delivery"
            ? "Out for delivery"
            : "Ready for pickup",
        color: styles.statusReady,
      };
    case "fulfilled":
      return {
        label: order.fulfillmentMode === "delivery" ? "Delivered" : "Picked up",
        color: styles.statusFulfilled,
      };
    case "cancelled":
      return { label: "Cancelled", color: styles.statusCancelled };
  }
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  const active = MOCK_ORDERS.filter((o) =>
    ["pending", "confirmed", "ready"].includes(o.status),
  );
  const past = MOCK_ORDERS.filter((o) =>
    ["fulfilled", "cancelled"].includes(o.status),
  );

  return (
    <div className={styles.page}>
      {success && (
        <div className={styles.successBanner}>
          Your order has been placed. Your cook will confirm pickup details
          shortly.
        </div>
      )}

      <div className={styles.inner}>
        <h1 className={styles.heading}>Your orders</h1>

        {active.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Active</h2>
            <div className={styles.orderList}>
              {active.map((order) => {
                const info = statusInfo(order);
                const fulfillmentPrefix =
                  order.fulfillmentMode === "delivery" ? "Delivery" : "Pickup";
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
                      {/* biome-ignore lint/performance/noImgElement: order thumbnail */}
                      <img
                        src="/placeholder.jpg"
                        alt=""
                        aria-hidden="true"
                        className={styles.orderCoverImg}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    </div>

                    <div className={styles.orderCenter}>
                      <span className={styles.cookName}>{order.cookName}</span>
                      <h3 className={styles.orderTitle}>
                        {order.listingTitle}
                      </h3>
                      <p className={styles.orderMeta}>
                        {fulfillmentPrefix} · {order.pickupDate} ·{" "}
                        {order.pickupWindow}
                      </p>
                      {order.isSubscription && (
                        <span className={styles.subscriptionTag}>
                          <RefreshCw size={10} />
                          Weekly subscription
                        </span>
                      )}
                    </div>

                    <div className={styles.orderRight}>
                      <span className={`${styles.statusBadge} ${info.color}`}>
                        {info.label}
                      </span>
                      <span className={styles.orderTotal}>
                        ${order.total}.00
                      </span>
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
                const info = statusInfo(order);
                const fulfillmentPrefix =
                  order.fulfillmentMode === "delivery" ? "Delivery" : "Pickup";
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
                        opacity: 0.6,
                      }}
                    >
                      {/* biome-ignore lint/performance/noImgElement: order thumbnail */}
                      <img
                        src="/placeholder.jpg"
                        alt=""
                        aria-hidden="true"
                        className={styles.orderCoverImg}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    </div>

                    <div className={styles.orderCenter}>
                      <span className={styles.cookName}>{order.cookName}</span>
                      <h3 className={styles.orderTitle}>
                        {order.listingTitle}
                      </h3>
                      <p className={styles.orderMeta}>
                        {fulfillmentPrefix} · {order.pickupDate}
                      </p>
                    </div>

                    <div className={styles.orderRight}>
                      <span className={`${styles.statusBadge} ${info.color}`}>
                        {info.label}
                      </span>
                      <div className={styles.orderPriceBlock}>
                        <span className={styles.orderTotal}>
                          ${order.total}.00
                        </span>
                        <Link
                          href={`/app/listings/${order.listingId}`}
                          className={styles.reorderBtn}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Order again
                        </Link>
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
