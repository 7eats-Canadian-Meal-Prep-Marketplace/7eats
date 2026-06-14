"use client";

import { Package, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  INTERVAL_LABELS,
  type SubscriptionInterval,
} from "@/lib/subscription-schedule";
import styles from "./page.module.css";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "ready"
  | "fulfilled"
  | "cancelled";

type ApiOrder = {
  id: string;
  status: OrderStatus;
  listingTitle: string | null;
  listingId: string | null;
  totalPrice: string | null;
  pickupDate: string | null;
  pickupWindow: string | null;
  fulfillmentMode: "pickup" | "delivery" | null;
  isSubscription: boolean;
  subscriptionInterval: SubscriptionInterval | null;
  cookName: string | null;
  cookInitials: string | null;
};

function statusInfo(order: ApiOrder): { label: string; color: string } {
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/app-auth/sign-in");
          return null;
        }
        return r.json();
      })
      .then((json) => {
        if (json) {
          setOrders(json.data ?? []);
        }
      })
      .catch(() => {
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const active = orders.filter((o) =>
    ["pending", "confirmed", "ready"].includes(o.status),
  );
  const past = orders.filter((o) =>
    ["fulfilled", "cancelled"].includes(o.status),
  );

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <h1 className={styles.heading}>Your orders</h1>
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Package size={40} />
            </div>
            <p className={styles.emptyDesc}>Loading your orders…</p>
          </div>
        </div>
      </div>
    );
  }

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
                      style={{
                        background:
                          "linear-gradient(135deg, #3a3a3a 0%, #1a1a1a 100%)",
                      }}
                    >
                      <span className={styles.orderCoverInitials}>
                        {order.cookInitials ?? "?"}
                      </span>
                    </div>

                    <div className={styles.orderCenter}>
                      <span className={styles.cookName}>
                        {order.cookName ?? "Unknown cook"}
                      </span>
                      <h3 className={styles.orderTitle}>
                        {order.listingTitle ?? "Order"}
                      </h3>
                      <p className={styles.orderMeta}>
                        {fulfillmentPrefix}
                        {order.pickupDate ? ` · ${order.pickupDate}` : ""}
                        {order.pickupWindow ? ` · ${order.pickupWindow}` : ""}
                      </p>
                      {order.isSubscription && (
                        <span className={styles.subscriptionTag}>
                          <RefreshCw size={10} />
                          {order.subscriptionInterval
                            ? `${INTERVAL_LABELS[order.subscriptionInterval]} subscription`
                            : "Subscription"}
                        </span>
                      )}
                    </div>

                    <div className={styles.orderRight}>
                      <span className={`${styles.statusBadge} ${info.color}`}>
                        {info.label}
                      </span>
                      <span className={styles.orderTotal}>
                        {order.totalPrice
                          ? `$${Number(order.totalPrice).toFixed(2)}`
                          : "—"}
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
                        background:
                          "linear-gradient(135deg, #3a3a3a 0%, #1a1a1a 100%)",
                        opacity: 0.6,
                      }}
                    >
                      <span className={styles.orderCoverInitials}>
                        {order.cookInitials ?? "?"}
                      </span>
                    </div>

                    <div className={styles.orderCenter}>
                      <span className={styles.cookName}>
                        {order.cookName ?? "Unknown cook"}
                      </span>
                      <h3 className={styles.orderTitle}>
                        {order.listingTitle ?? "Order"}
                      </h3>
                      <p className={styles.orderMeta}>
                        {fulfillmentPrefix}
                        {order.pickupDate ? ` · ${order.pickupDate}` : ""}
                      </p>
                    </div>

                    <div className={styles.orderRight}>
                      <span className={`${styles.statusBadge} ${info.color}`}>
                        {info.label}
                      </span>
                      <div className={styles.orderPriceBlock}>
                        <span className={styles.orderTotal}>
                          {order.totalPrice
                            ? `$${Number(order.totalPrice).toFixed(2)}`
                            : "—"}
                        </span>
                        {order.listingId && (
                          <Link
                            href={`/app/listings/${order.listingId}`}
                            className={styles.reorderBtn}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Order again
                          </Link>
                        )}
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
