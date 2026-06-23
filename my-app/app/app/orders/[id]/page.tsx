"use client";

import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Edit3,
  MapPin,
  Package,
  Star,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type ClientOrderStatus,
  clientOrderTrackerSteps,
} from "@/lib/client-order-status";
import { Skeleton } from "../../_skeleton";
import { OrderCookHero } from "../_cook-visual";
import styles from "./page.module.css";

// ─── Types ──────────────────────────────────────────────────────────────────────

type OrderStatus = ClientOrderStatus;

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
  taxAmount: string | null;
  taxProvince: string | null;
  taxLabel: string | null;
  deliveryFeeSnapshot: string | null;
  currency: string | null;
  pickupAt: string | null;
  pickupDate: string | null;
  pickupWindow: string | null;
  timingSchedule: string;
  timingHint: string | null;
  pickupCode: string | null;
  pickupAddress: string | null;
  fulfillmentMode: "pickup" | "delivery" | null;
  cancellationAllowed: boolean;
  cancellable: boolean;
  refundEligible: boolean;
  refundDeadlineLabel: string | null;
  cancelSummary: string;
  cancelDetail: string;
  cancelModalReminder: string;
  cookName: string | null;
  cookInitials: string | null;
  cookPhotoUrl: string | null;
  cookBannerUrl: string | null;
  dishes: ApiDish[];
  cancelledAt: string | null;
  review: {
    id: string;
    rating: number;
    comment: string;
  } | null;
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

// ─── Cancel modal ──────────────────────────────────────────────────────────────

function CancelOrderModal({
  cookName,
  listingTitle,
  policyLine,
  refundEligible,
  reminder,
  loading,
  error,
  onConfirm,
  onClose,
}: {
  cookName: string;
  listingTitle: string;
  policyLine: string;
  refundEligible: boolean;
  reminder: string;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop dismiss
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop dismiss
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-order-title"
        className={styles.cancelModal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className={styles.cancelModalHead}>
          <div>
            <p className={styles.modalEyebrow}>{cookName}</p>
            <h2 id="cancel-order-title" className={styles.cancelModalTitle}>
              Cancel this order?
            </h2>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className={styles.cancelModalOrder}>{listingTitle}</p>

        {policyLine && <p className={styles.cancelModalPolicy}>{policyLine}</p>}
        {reminder && <p className={styles.cancelModalReminder}>{reminder}</p>}

        {error && (
          <p className={styles.cancelModalError} role="alert">
            {error}
          </p>
        )}

        <div className={styles.cancelModalActions}>
          <button
            type="button"
            className={styles.cancelModalKeep}
            onClick={onClose}
            disabled={loading}
          >
            Keep order
          </button>
          <button
            type="button"
            className={styles.cancelModalConfirm}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading
              ? "Cancelling…"
              : refundEligible
                ? "Cancel and refund"
                : "Cancel without refund"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Review modal ──────────────────────────────────────────────────────────────

function ReviewModal({
  cookName,
  listingTitle,
  initial,
  saving,
  onSave,
  onClose,
}: {
  cookName: string;
  listingTitle: string;
  initial?: { rating: number; comment: string };
  saving: boolean;
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
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.modalSubmit}
            disabled={saving}
            onClick={() => {
              if (rating > 0) {
                onSave(rating, comment);
              }
            }}
          >
            {saving ? "Saving…" : initial ? "Update review" : "Submit review"}
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
    id: string;
    rating: number;
    comment: string;
  } | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewDeleting, setReviewDeleting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowCancelModal(false);
        router.replace(
          data.refunded
            ? "/app/orders?cancelled=refunded"
            : "/app/orders?cancelled=1",
        );
        return;
      }
      setCancelError(data.error ?? "Could not cancel the order.");
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => {
        if (r.status === 401) {
          router.replace("/app-auth/login");
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
          setReview(json.data.review ?? null);
        }
      })
      .catch(() => {
        router.replace("/app/orders");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleSaveReview(rating: number, comment: string) {
    if (reviewSaving) return;
    setReviewSaving(true);
    try {
      const isUpdate = review != null;
      const res = await fetch(`/api/orders/${id}/reviews`, {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { id: string; rating: number; comment: string | null };
        error?: string;
      };
      if (!res.ok || !data.success || !data.data) {
        toast.error(data.error ?? "Could not save your review.");
        return;
      }
      setReview({
        id: data.data.id,
        rating: data.data.rating,
        comment: data.data.comment ?? "",
      });
      setShowReviewModal(false);
      toast.success(isUpdate ? "Review updated." : "Thanks for your review!");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setReviewSaving(false);
    }
  }

  async function handleDeleteReview() {
    if (reviewDeleting || !review) return;
    setReviewDeleting(true);
    try {
      const res = await fetch(`/api/orders/${id}/reviews`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Could not delete your review.");
        return;
      }
      setReview(null);
      toast.success("Review removed.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setReviewDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.backRow}>
            <Link href="/app/orders" className={styles.backBtn}>
              <ArrowLeft size={16} />
              All orders
            </Link>
            <Skeleton width={72} height={12} radius={4} />
          </div>
          <div className={styles.heroSkeleton}>
            <Skeleton width="100%" height={84} radius={0} />
            <div className={styles.heroSkeletonBody}>
              <Skeleton circle width={56} height={56} />
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <Skeleton width="45%" height={14} radius={6} />
                <Skeleton width="70%" height={22} radius={6} />
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <Skeleton width="100%" height={48} radius={10} />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={72} radius={12} />
            ))}
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

  const steps = clientOrderTrackerSteps(order.status, order.fulfillmentMode);

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

        <OrderCookHero
          bannerUrl={order.cookBannerUrl}
          photoUrl={order.cookPhotoUrl}
          initials={cookInitials}
          cookName={cookDisplayName}
          title={listingTitle}
        />

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
                    onClick={() => void handleDeleteReview()}
                    disabled={reviewDeleting}
                    aria-label="Delete review"
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
          {!isCancelled && (
            <div className={styles.detailRow}>
              <Clock size={15} className={styles.detailIcon} />
              <div>
                <div className={styles.detailLabel}>Date & time</div>
                <div className={styles.detailVal}>
                  {order.timingSchedule ?? "TBD"}
                </div>
                {order.timingHint && (
                  <p className={styles.detailHint}>{order.timingHint}</p>
                )}
              </div>
            </div>
          )}
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
          {(() => {
            const subtotal = order.dishes.reduce(
              (sum, dish) => sum + Number(dish.lineTotal ?? 0),
              0,
            );
            const deliveryFee = Number(order.deliveryFeeSnapshot ?? 0);
            const taxAmount = Number(order.taxAmount ?? 0);
            return (
              <>
                <div className={styles.dishRow}>
                  <span className={styles.dishQty} />
                  <span className={styles.totalLabel}>Subtotal</span>
                  <span className={styles.totalVal}>
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                {deliveryFee > 0 && (
                  <div className={styles.dishRow}>
                    <span className={styles.dishQty} />
                    <span className={styles.totalLabel}>Delivery</span>
                    <span className={styles.totalVal}>
                      ${deliveryFee.toFixed(2)}
                    </span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className={styles.dishRow}>
                    <span className={styles.dishQty} />
                    <span className={styles.totalLabel}>
                      {order.taxLabel ?? "Tax"}
                    </span>
                    <span className={styles.totalVal}>
                      ${taxAmount.toFixed(2)}
                    </span>
                  </div>
                )}
              </>
            );
          })()}
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
          <section className={styles.cancelCard}>
            <h2 className={styles.cancelTitle}>Need to cancel?</h2>
            <p className={styles.cancelSummary}>{order.cancelSummary}</p>
            {order.cancelDetail ? (
              <p className={styles.cancelDesc}>{order.cancelDetail}</p>
            ) : null}
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => {
                setCancelError(null);
                setShowCancelModal(true);
              }}
            >
              Cancel order
            </button>
          </section>
        )}
      </div>

      {showCancelModal && order && (
        <CancelOrderModal
          cookName={cookDisplayName}
          listingTitle={listingTitle}
          policyLine={order.cancelSummary}
          refundEligible={order.refundEligible}
          reminder={order.cancelModalReminder}
          loading={cancelling}
          error={cancelError}
          onConfirm={() => void handleCancel()}
          onClose={() => {
            if (!cancelling) setShowCancelModal(false);
          }}
        />
      )}

      {/* Review modal */}
      {showReviewModal && (
        <ReviewModal
          cookName={cookDisplayName}
          listingTitle={listingTitle}
          initial={review ?? undefined}
          saving={reviewSaving}
          onSave={(rating, comment) => void handleSaveReview(rating, comment)}
          onClose={() => {
            if (!reviewSaving) setShowReviewModal(false);
          }}
        />
      )}
    </div>
  );
}
