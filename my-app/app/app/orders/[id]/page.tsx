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
import { use, useState } from "react";
import { MOCK_ORDERS } from "../../_mock";
import styles from "./page.module.css";

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
  const order = MOCK_ORDERS.find((o) => o.id === id) ?? MOCK_ORDERS[0];
  const [copied, setCopied] = useState(false);
  const [review, setReview] = useState<{
    rating: number;
    comment: string;
  } | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(order.pickupCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDelivery = order.fulfillmentMode === "delivery";

  const steps = order.isSubscription
    ? [
        { label: `Auto-confirmed · ${order.pickupDate}`, done: true },
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
      ]
    : [
        {
          label: "Awaiting confirmation",
          done: ["confirmed", "ready", "fulfilled"].includes(order.status),
          active: order.status === "pending",
        },
        { label: "Order placed", done: true },
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

  const isCancelled = order.status === "cancelled";
  const isDone = order.status === "fulfilled";

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

        {/* Header */}
        <div
          className={styles.heroCard}
          style={{ background: order.listingGradient }}
        >
          <div className={styles.heroInitials}>
            {order.cookName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className={styles.heroInfo}>
            <div className={styles.heroCook}>{order.cookName}</div>
            <div className={styles.heroTitle}>{order.listingTitle}</div>
          </div>
        </div>

        {/* Message CTA */}
        {!isCancelled && !isDone && (
          <Link href="/app/inbox" className={styles.messageCta}>
            <MessageSquare size={16} />
            Message {order.cookName}
          </Link>
        )}

        {/* Code card */}
        {!isCancelled && (
          <div className={styles.codeCard}>
            <div className={styles.codeLabel}>
              {order.isSubscription
                ? isDelivery
                  ? `Weekly delivery code · ${order.pickupDate}`
                  : `Weekly pickup code · ${order.pickupDate}`
                : isDelivery
                  ? "Your delivery code"
                  : "Your pickup code"}
            </div>
            <div className={styles.codeDisplay}>{order.pickupCode}</div>
            <p className={styles.codeDesc}>
              {isDelivery
                ? `Share this code with ${order.cookName} when your order arrives.`
                : `Show this code to ${order.cookName} when you arrive.`}
              {order.isSubscription &&
                " Your code renews automatically each week."}
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
                {order.pickupDate} · {order.pickupWindow}
              </div>
            </div>
          </div>
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
      </div>

      {/* Review modal */}
      {showReviewModal && (
        <ReviewModal
          cookName={order.cookName}
          listingTitle={order.listingTitle}
          initial={review ?? undefined}
          onSave={(rating, comment) => setReview({ rating, comment })}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </div>
  );
}
