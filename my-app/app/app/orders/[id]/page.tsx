"use client";

import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Edit3,
  MapPin,
  MessageSquare,
  Package,
  Star,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import styles from "./page.module.css";

// ─── Types ──────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "pending"
  | "confirmed"
  | "ready"
  | "fulfilled"
  | "cancelled";

type ApiDish = {
  id: string;
  dishName: string;
  quantity: number;
  priceSnapshot: string | null;
  discountAmount: string | null;
  lineTotal: string | null;
  sortOrder: number;
};

type ApiOrder = {
  id: string;
  status: OrderStatus;
  totalPrice: string | null;
  currency: string | null;
  pickupAt: string | null;
  pickupDate: string | null;
  pickupWindow: string | null;
  pickupCode: string | null;
  pickupAddress: string | null;
  fulfillmentMode: "pickup" | "delivery" | null;
  cancellationAllowed: boolean;
  cancellable: boolean;
  refundEligible: boolean;
  cookName: string | null;
  cookInitials: string | null;
  dishes: ApiDish[];
  cancelledAt: string | null;
};

function orderTitle(o: ApiOrder): string {
  if (o.dishes.length > 0) {
    const extra = o.dishes.length - 1;
    return extra > 0
      ? `${o.dishes[0].dishName} +${extra} more`
      : o.dishes[0].dishName;
  }
  return "Order";
}

// ─── Review modal ──────────────────────────────────────────────────────────────

function ReviewModal({
  cookName,
  listingTitle,
  initial,
  onSave,
  onClose,
}: {
  cookName: string;
  listingTitle: string;
  initial?: { rating: number; comment: string };
  onSave: (rating: number, comment: string) => void;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(initial?.comment ?? "");

  const displayed = hoverRating || rating;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop dismiss
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop dismiss
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <div>
            <p className={styles.modalEyebrow}>{cookName}</p>
            <h2 className={styles.modalTitle}>{listingTitle}</h2>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={styles.starBtn}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(n)}
              aria-label={`Rate ${n} star${n !== 1 ? "s" : ""}`}
            >
              <Star
                size={28}
                fill={n <= displayed ? "currentColor" : "none"}
                className={n <= displayed ? styles.starOn : styles.starOff}
              />
            </button>
          ))}
        </div>
        <p className={styles.ratingLabel}>
          {["", "Poor", "Fair", "Good", "Great", "Excellent!"][displayed]}
        </p>

        <textarea
          className={styles.reviewTextarea}
          placeholder={`What did you think of ${cookName}'s cooking?`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
        />

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalCancel}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.modalSubmit}
            onClick={() => {
              if (rating > 0) {
                onSave(rating, comment);
                onClose();
              }
            }}
          >
            {initial ? "Update review" : "Submit review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [review, setReview] = useState<{
    rating: number;
    comment: string;
  } | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    if (cancelling) return;
    const msg = order?.refundEligible
      ? "Cancel this order? You'll receive a full refund."
      : "Cancel this order? No refund will be issued.";
    if (!window.confirm(msg)) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        window.alert(
          data.refunded
            ? "Order cancelled — your refund is on its way."
            : "Order cancelled.",
        );
        router.refresh();
        router.replace("/app/orders");
      } else {
        window.alert(data.error ?? "Could not cancel the order.");
      }
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => {
        if (r.status === 401) {
          router.replace("/app-auth/sign-in");
          return null;
        }
        if (r.status === 404) {
          router.replace("/app/orders");
          return null;
        }
        return r.json();
      })
      .then((json) => {
        if (json?.data) {
          setOrder(json.data);
        }
      })
      .catch(() => {
        router.replace("/app/orders");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.backRow}>
            <Link href="/app/orders" className={styles.backBtn}>
              <ArrowLeft size={16} />
              All orders
            </Link>
          </div>
          <div
            className={styles.heroCard}
            style={{
              background: "linear-gradient(135deg, #3a3a3a 0%, #1a1a1a 100%)",
            }}
          >
            <div className={styles.heroInitials}>…</div>
            <div className={styles.heroInfo}>
              <div className={styles.heroCook}>Loading…</div>
              <div className={styles.heroTitle}>Loading order</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const copyCode = () => {
    if (order.pickupCode) {
      navigator.clipboard.writeText(order.pickupCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isDelivery = order.fulfillmentMode === "delivery";
  const isCancelled = order.status === "cancelled";
  const isDone = order.status === "fulfilled";

  const cookDisplayName = order.cookName ?? "Your cook";
  const cookInitials = order.cookInitials ?? "?";
  const listingTitle = orderTitle(order);

  const steps = [
    { label: "Order placed", done: true },
    {
      label: "Awaiting confirmation",
      done: ["confirmed", "ready", "fulfilled"].includes(order.status),
    },
    {
      label: "Cook is preparing",
      done: ["confirmed", "ready", "fulfilled"].includes(order.status),
    },
    {
      label: isDelivery ? "Out for delivery" : "Ready for pickup",
      done: ["ready", "fulfilled"].includes(order.status),
    },
    {
      label: isDelivery ? "Delivered" : "Picked up",
      done: order.status === "fulfilled",
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.backRow}>
          <Link href="/app/orders" className={styles.backBtn}>
            <ArrowLeft size={16} />
            All orders
          </Link>
          <span className={styles.orderId}>
            #{order.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        {/* Header */}
        <div
          className={styles.heroCard}
          style={{
            background: "linear-gradient(135deg, #3a3a3a 0%, #1a1a1a 100%)",
          }}
        >
          <div className={styles.heroInitials}>
            {cookInitials.toUpperCase()}
          </div>
          <div className={styles.heroInfo}>
            <div className={styles.heroCook}>{cookDisplayName}</div>
            <div className={styles.heroTitle}>{listingTitle}</div>
          </div>
        </div>

        {/* Cancellation banner */}
        {isCancelled && (
          <div className={styles.cancelledBanner}>
            <span className={styles.cancelledBannerTitle}>
              This order was cancelled
            </span>
            {order.cancelledAt && (
              <span className={styles.cancelledBannerDate}>
                {new Date(order.cancelledAt).toLocaleDateString("en-CA", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        )}

        {/* Message CTA */}
        {!isCancelled && !isDone && (
          <Link href="/app/inbox" className={styles.messageCta}>
            <MessageSquare size={16} />
            Message {cookDisplayName}
          </Link>
        )}

        {/* Code card — only shown when status is "ready" and a pickup code exists */}
        {order.status === "ready" && order.pickupCode && (
          <div className={styles.codeCard}>
            <div className={styles.codeLabel}>
              {isDelivery ? "Your delivery code" : "Your pickup code"}
            </div>
            <div className={styles.codeDisplay}>{order.pickupCode}</div>
            <p className={styles.codeDesc}>
              {isDelivery
                ? `Share this code with ${cookDisplayName} when your order arrives.`
                : `Show this code to ${cookDisplayName} when you arrive.`}
            </p>
            <button type="button" className={styles.copyBtn} onClick={copyCode}>
              {copied ? "Copied!" : "Copy code"}
            </button>
          </div>
        )}

        {/* Status tracker */}
        {!isCancelled && (
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
        )}

        {/* Review section — shown when fulfilled */}
        {isDone &&
          (review ? (
            <div className={styles.reviewCard}>
              <div className={styles.reviewCardHead}>
                <div className={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={16}
                      fill={n <= review.rating ? "currentColor" : "none"}
                      className={
                        n <= review.rating ? styles.starOn : styles.starOff
                      }
                    />
                  ))}
                </div>
                <div className={styles.reviewCardActions}>
                  <button
                    type="button"
                    className={styles.reviewEditBtn}
                    onClick={() => setShowReviewModal(true)}
                  >
                    <Edit3 size={14} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.reviewDeleteBtn}
                    onClick={() => setReview(null)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {review.comment && (
                <p className={styles.reviewComment}>{review.comment}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              className={styles.rateBtn}
              onClick={() => setShowReviewModal(true)}
            >
              <Star size={16} />
              Leave a review
            </button>
          ))}

        {/* Fulfillment details */}
        <div className={styles.detailsCard}>
          <h2 className={styles.sectionTitle}>
            {isDelivery ? "Delivery details" : "Pickup details"}
          </h2>
          <div className={styles.detailRow}>
            <Clock size={15} className={styles.detailIcon} />
            <div>
              <div className={styles.detailLabel}>Date & time</div>
              <div className={styles.detailVal}>
                {order.pickupDate && order.pickupWindow
                  ? `${order.pickupDate} · ${order.pickupWindow}`
                  : (order.pickupDate ?? order.pickupWindow ?? "TBD")}
              </div>
            </div>
          </div>
          {order.pickupAddress && (
            <div className={styles.detailRow}>
              {isDelivery ? (
                <Truck size={15} className={styles.detailIcon} />
              ) : (
                <MapPin size={15} className={styles.detailIcon} />
              )}
              <div>
                <div className={styles.detailLabel}>
                  {isDelivery ? "Delivery address" : "Location"}
                </div>
                <div className={styles.detailVal}>{order.pickupAddress}</div>
              </div>
            </div>
          )}
          <div className={styles.detailRow}>
            <Package size={15} className={styles.detailIcon} />
            <div>
              <div className={styles.detailLabel}>Cook</div>
              <div className={styles.detailVal}>{cookDisplayName}</div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className={styles.itemsCard}>
          <h2 className={styles.sectionTitle}>Items</h2>
          {order.dishes.map((dish) => (
            <div key={dish.id} className={styles.dishRow}>
              <span className={styles.dishQty}>{dish.quantity}×</span>
              <span className={styles.dishName}>
                {dish.dishName}
                {dish.discountAmount && Number(dish.discountAmount) > 0
                  ? ` (−$${Number(dish.discountAmount).toFixed(2)})`
                  : ""}
              </span>
              {dish.lineTotal && (
                <span className={styles.totalVal}>
                  ${Number(dish.lineTotal).toFixed(2)}
                </span>
              )}
            </div>
          ))}
          <div className={styles.totalDivider} />
          <div className={`${styles.dishRow} ${styles.totalRow}`}>
            <span className={styles.dishQty} />
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.totalVal}>
              {order.totalPrice
                ? `$${Number(order.totalPrice).toFixed(2)}`
                : "—"}
              {order.currency ? ` ${order.currency}` : ""}
            </span>
          </div>
        </div>

        {order.cancellable && (
          <div className={styles.itemsCard}>
            <button
              type="button"
              className={styles.modalCancel}
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel order"}
            </button>
            <p className={styles.codeDesc}>
              {order.refundEligible
                ? "You can cancel now for a full refund."
                : "Cancelling now will not be refunded."}
            </p>
          </div>
        )}
      </div>

      {/* Review modal */}
      {showReviewModal && (
        <ReviewModal
          cookName={cookDisplayName}
          listingTitle={listingTitle}
          initial={review ?? undefined}
          onSave={(rating, comment) => setReview({ rating, comment })}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </div>
  );
}
