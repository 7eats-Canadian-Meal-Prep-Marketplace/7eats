"use client";

import {
  ArrowLeft,
  CheckCircle,
  Clock,
  MapPin,
  MessageSquare,
  Package,
  Star,
} from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { MOCK_ORDERS } from "../../_mock";
import styles from "./page.module.css";

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const order = MOCK_ORDERS.find((o) => o.id === id) ?? MOCK_ORDERS[0];
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(order.pickupCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    { label: "Order confirmed", done: true },
    { label: "Cook is preparing", done: order.status !== "confirmed" },
    { label: "Ready for pickup", done: order.status === "completed" },
    { label: "Picked up", done: order.status === "completed" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.backRow}>
          <Link href="/app/orders" className={styles.backBtn}>
            <ArrowLeft size={16} />
            All orders
          </Link>
          <span className={styles.orderId}>#{order.id.toUpperCase()}</span>
        </div>

        {/* Header card */}
        <div
          className={styles.heroCard}
          style={{ background: order.listingGradient }}
        >
          <span className={styles.heroEmoji}>{order.listingEmoji}</span>
          <div className={styles.heroInfo}>
            <div className={styles.heroCook}>{order.cookName}</div>
            <div className={styles.heroTitle}>{order.listingTitle}</div>
          </div>
        </div>

        {/* Pickup code */}
        <div className={styles.codeCard}>
          <div className={styles.codeLabel}>Your pickup code</div>
          <div className={styles.codeDisplay}>{order.pickupCode}</div>
          <p className={styles.codeDesc}>
            Show this code to {order.cookName} when you arrive.
          </p>
          <button type="button" className={styles.copyBtn} onClick={copyCode}>
            {copied ? "Copied!" : "Copy code"}
          </button>
        </div>

        {/* Status tracker */}
        <div className={styles.statusCard}>
          <h2 className={styles.sectionTitle}>Order status</h2>
          <div className={styles.tracker}>
            {steps.map((step, i) => (
              <div key={step.label} className={styles.step}>
                <div className={styles.stepLeft}>
                  <div
                    className={`${styles.stepDot} ${step.done ? styles.stepDotDone : ""}`}
                  >
                    {step.done ? (
                      <CheckCircle size={14} />
                    ) : (
                      <Clock size={14} />
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`${styles.stepLine} ${step.done ? styles.stepLineDone : ""}`}
                    />
                  )}
                </div>
                <span
                  className={`${styles.stepLabel} ${step.done ? styles.stepLabelDone : ""}`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pickup details */}
        <div className={styles.detailsCard}>
          <h2 className={styles.sectionTitle}>Pickup details</h2>
          <div className={styles.detailRow}>
            <Clock size={15} className={styles.detailIcon} />
            <div>
              <div className={styles.detailLabel}>Date & time</div>
              <div className={styles.detailVal}>
                {order.pickupDate} · {order.pickupWindow}
              </div>
            </div>
          </div>
          <div className={styles.detailRow}>
            <MapPin size={15} className={styles.detailIcon} />
            <div>
              <div className={styles.detailLabel}>Location</div>
              <div className={styles.detailVal}>{order.pickupAddress}</div>
            </div>
          </div>
          <div className={styles.detailRow}>
            <Package size={15} className={styles.detailIcon} />
            <div>
              <div className={styles.detailLabel}>Cook</div>
              <div className={styles.detailVal}>{order.cookName}</div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className={styles.itemsCard}>
          <h2 className={styles.sectionTitle}>Items</h2>
          {order.dishes.map((dish) => (
            <div key={dish.name} className={styles.dishRow}>
              <span className={styles.dishQty}>{dish.quantity}×</span>
              <span className={styles.dishName}>{dish.name}</span>
              <span className={styles.dishPrice}>
                ${dish.price * dish.quantity}
              </span>
            </div>
          ))}
          <div className={styles.totalDivider} />
          <div className={styles.dishRow}>
            <span className={styles.dishQty} />
            <span className={styles.summaryLabel}>Subtotal</span>
            <span className={styles.summaryVal}>${order.subtotal}.00</span>
          </div>
          <div className={styles.dishRow}>
            <span className={styles.dishQty} />
            <span className={styles.summaryLabel}>Service fee</span>
            <span className={styles.summaryVal}>${order.serviceFee}.00</span>
          </div>
          <div className={`${styles.dishRow} ${styles.totalRow}`}>
            <span className={styles.dishQty} />
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.totalVal}>${order.total}.00</span>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <Link href="/app/inbox" className={styles.messageBtn}>
            <MessageSquare size={16} />
            Message {order.cookName}
          </Link>
          {order.status === "completed" && (
            <button type="button" className={styles.rateBtn}>
              <Star size={16} />
              Leave a review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
