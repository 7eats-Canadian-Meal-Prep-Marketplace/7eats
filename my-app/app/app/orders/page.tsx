"use client";

import { Package } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  type ClientOrderStatus,
  clientOrderStatusLabel,
} from "@/lib/client-order-status";
import { Skeleton } from "../_skeleton";
import { OrderCookCover } from "./_cook-visual";
import styles from "./page.module.css";

type OrderStatus = ClientOrderStatus;

type ApiOrder = {
  id: string;
  status: OrderStatus;
  dishes?: { dishName: string; quantity: number }[];
  totalPrice: string | null;
  pickupDate: string | null;
  pickupWindow: string | null;
  timingSchedule: string;
  timingHint: string | null;
  fulfillmentMode: "pickup" | "delivery" | null;
  cookName: string | null;
  cookInitials: string | null;
  cookPhotoUrl: string | null;
  cookBannerUrl: string | null;
};

function orderTitle(o: ApiOrder): string {
  if (o.dishes && o.dishes.length > 0) {
    const extra = o.dishes.length - 1;
    return extra > 0
      ? `${o.dishes[0].dishName} +${extra} more`
      : o.dishes[0].dishName;
  }
  return "Order";
}

function statusInfo(order: ApiOrder): { label: string; color: string } {
  const label = clientOrderStatusLabel(order.status, order.fulfillmentMode);
  switch (order.status) {
    case "pending":
      return { label, color: styles.statusPending };
    case "confirmed":
      return { label, color: styles.statusConfirmed };
    case "ready":
      return { label, color: styles.statusReady };
    case "fulfilled":
      return { label, color: styles.statusFulfilled };
    case "cancelled":
      return { label, color: styles.statusCancelled };
  }
}

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const cancelled = searchParams.get("cancelled");

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/app-auth/login");
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
          <section className={styles.section}>
            <Skeleton width={56} height={11} radius={4} />
            <div className={styles.orderList} style={{ marginTop: 16 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.orderCard} aria-hidden="true">
                  <Skeleton circle width={56} height={56} />
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <Skeleton width="40%" height={13} radius={6} />
                    <Skeleton width="65%" height={18} radius={6} />
                    <Skeleton width="50%" height={12} radius={6} />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 8,
                    }}
                  >
                    <Skeleton width={72} height={24} radius={12} />
                    <Skeleton width={48} height={16} radius={6} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {success && (
          <div className={styles.successBanner}>
            Your order has been placed. Your cook will confirm pickup details
            shortly.
          </div>
        )}
        {cancelled && (
          <div className={styles.successBanner}>
            {cancelled === "refunded"
              ? "Order cancelled. Your refund is on its way."
              : "Order cancelled."}
          </div>
        )}

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
                    <OrderCookCover
                      bannerUrl={order.cookBannerUrl}
                      photoUrl={order.cookPhotoUrl}
                      initials={order.cookInitials}
                    />

                    <div className={styles.orderCenter}>
                      <span className={styles.cookName}>
                        {order.cookName ?? "Unknown cook"}
                      </span>
                      <h3 className={styles.orderTitle}>{orderTitle(order)}</h3>
                      <p className={styles.orderMeta}>
                        {fulfillmentPrefix}
                        {order.timingSchedule && order.timingSchedule !== "TBD"
                          ? ` · ${order.timingSchedule}`
                          : order.pickupDate
                            ? ` · ${order.pickupDate}`
                            : ""}
                      </p>
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
                    className={styles.orderCard}
                  >
                    <OrderCookCover
                      bannerUrl={order.cookBannerUrl}
                      photoUrl={order.cookPhotoUrl}
                      initials={order.cookInitials}
                    />

                    <div className={styles.orderCenter}>
                      <span className={styles.cookName}>
                        {order.cookName ?? "Unknown cook"}
                      </span>
                      <h3 className={styles.orderTitle}>{orderTitle(order)}</h3>
                      <p className={styles.orderMeta}>
                        {fulfillmentPrefix}
                        {order.timingSchedule && order.timingSchedule !== "TBD"
                          ? ` · ${order.timingSchedule}`
                          : order.pickupDate
                            ? ` · ${order.pickupDate}`
                            : ""}
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
