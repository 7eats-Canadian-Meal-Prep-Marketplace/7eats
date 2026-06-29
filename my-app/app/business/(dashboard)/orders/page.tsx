"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Truck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DELETED_ACCOUNT_DISPLAY_NAME } from "@/lib/client-account-deletion-policy";
import { arrivalSlots } from "@/lib/delivery-arrival";
import { canMarkReady, readyAvailableFrom } from "@/lib/order-readiness";
import {
  type CookClientOrderFields,
  cookClientDisplayName,
  isCookClientDeleted,
} from "@/lib/orders/cook-client-display";
import { PreferenceSheet } from "../_components/PreferenceSheet";
import { Skeleton } from "../_skeleton";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "pending"
  | "confirmed"
  | "ready"
  | "fulfilled"
  | "cancelled";

type DeliveryAddress = {
  street?: string | null;
  unit?: string | null;
  city?: string | null;
  province?: string | null;
  postal?: string | null;
};

type DishSnapshot = {
  id: string;
  dishId: string;
  dishName: string;
  quantity: number;
  priceSnapshot: string | null;
  discountAmount: string | null;
  lineTotal: string | null;
  sortOrder: number;
};

type Order = CookClientOrderFields & {
  id: string;
  status: OrderStatus;
  clientId: string | null;
  listingTitle: string | null;
  // Deprecated order-level fields — null for current multi-dish orders.
  quantity: number | null;
  unitPrice: string | null;
  // Derived in the list endpoint from order_dishes (total items in the order).
  itemCount?: number;
  totalPrice: string;
  taxAmount: string | null;
  deliveryFeeSnapshot: string | null;
  // Platform-funded discount applied to the customer's total. Does NOT reduce
  // the cook's payout; shown on the receipt so the customer total reconciles.
  platformDiscountAmount?: string | null;
  // Money breakdown from order_payments (list + detail).
  platformFeePct?: string | null;
  platformFeeAmount?: string | null;
  cookPayoutAmount?: string | null;
  fulfillmentMode: string | null;
  deliveryAddress: DeliveryAddress | null;
  pickupAt: string | null;
  fulfillmentWindowStart: string | null;
  fulfillmentWindowEnd: string | null;
  notes: string | null;
  deliveryDetails: string | null;
  pickupCodeAttempts: number;
  createdAt: string;
  dishes?: DishSnapshot[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(
  order: Pick<
    Order,
    "pickupAt" | "fulfillmentWindowStart" | "fulfillmentWindowEnd"
  >,
): string {
  const iso = order.pickupAt ?? order.fulfillmentWindowStart;
  if (!iso) return "Not scheduled";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not scheduled";
  const windowEnd = order.pickupAt ? null : order.fulfillmentWindowEnd;
  const end = windowEnd ? new Date(windowEnd) : null;
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time =
    end && !Number.isNaN(end.getTime())
      ? `${formatClock(d)}–${formatClock(end)}`
      : formatClock(d);
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  if (d.toDateString() === yesterday.toDateString())
    return `Yesterday · ${time}`;
  return `${d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}

function money(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

function fulfillmentLabel(order: Pick<Order, "fulfillmentMode">): string {
  return order.fulfillmentMode === "delivery" ? "Delivery" : "Pickup";
}

// "123 King St, Apt 4 · Toronto, ON M5V 1A1" split into two lines for display.
function addressLines(addr: DeliveryAddress | null): [string, string] | null {
  if (!addr) return null;
  const line1 = [addr.street, addr.unit].filter(Boolean).join(", ");
  const line2 = [
    [addr.city, addr.province].filter(Boolean).join(", "),
    addr.postal,
  ]
    .filter(Boolean)
    .join(" ");
  if (!line1 && !line2) return null;
  return [line1, line2];
}

function formatSlotClock(d: Date): string {
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

function dishesSubtotal(dishes: DishSnapshot[] | undefined): number {
  if (!dishes) return 0;
  return dishes.reduce(
    (sum, d) => sum + Number.parseFloat(d.lineTotal ?? "0"),
    0,
  );
}

function CustomerName({
  order,
  className,
}: {
  order: CookClientOrderFields;
  className?: string;
}) {
  const name = cookClientDisplayName(order);
  const deleted = isCookClientDeleted(order);
  const showDeletedTag = deleted && name !== DELETED_ACCOUNT_DISPLAY_NAME;

  return (
    <span className={className}>
      {name}
      {showDeletedTag && (
        <span className={styles.clientTagDeleted}>Deleted</span>
      )}
    </span>
  );
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready: "Ready",
  fulfilled: "Complete",
  cancelled: "Cancelled",
};

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "Confirm",
  confirmed: "Mark ready",
};

const BADGE_CLS: Record<OrderStatus, string> = {
  pending: styles.badgePending,
  confirmed: styles.badgeConfirmed,
  ready: styles.badgeReady,
  fulfilled: styles.badgeFulfilled,
  cancelled: styles.badgeCancelled,
};

const MAX_ATTEMPTS = 5;

function nextStatus(s: OrderStatus): "confirmed" | "ready" | null {
  const map: Partial<Record<OrderStatus, "confirmed" | "ready">> = {
    pending: "confirmed",
    confirmed: "ready",
  };
  return map[s] ?? null;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

// Inline spinner for buttons mid-request. `label` doubles as the accessible
// status text so screen readers announce that the action is processing.
function Spinner({ label = "Processing" }: { label?: string }) {
  return (
    <span className={styles.btnLoading}>
      <span className={styles.spinner} aria-hidden="true" />
      <output className={styles.srOnly}>{label}</output>
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`${styles.badge} ${BADGE_CLS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Pickup code verification ─────────────────────────────────────────────────

function VerifyCode({
  orderId,
  initialAttempts,
  onVerify,
}: {
  orderId: string;
  initialAttempts: number;
  onVerify: () => void;
}) {
  const [code, setCode] = useState("");
  const [attempts, setAttempts] = useState(initialAttempts);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const locked = attempts >= MAX_ATTEMPTS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || locked) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/business/dashboard/orders/${orderId}/verify-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        },
      );
      const json = await res.json();
      if (res.ok) {
        onVerify();
      } else {
        const remaining = json.attemptsRemaining ?? MAX_ATTEMPTS - attempts - 1;
        setAttempts(MAX_ATTEMPTS - remaining);
        setError(
          remaining <= 0
            ? "Code entry locked."
            : `Incorrect. ${remaining} attempt${remaining === 1 ? "" : "s"} left`,
        );
        setCode("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (locked) {
    return (
      <div className={styles.verifyLocked}>
        Code entry locked after {MAX_ATTEMPTS} failed attempts.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.verifyForm}>
      <p className={styles.verifyLabel}>Enter customer&apos;s pickup code</p>
      <div className={styles.verifyRow}>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className={styles.verifyInput}
        />
        <button
          type="submit"
          className={styles.verifyBtn}
          disabled={code.length < 6 || submitting}
        >
          {submitting ? <Spinner label="Verifying" /> : "Verify"}
        </button>
      </div>
      {error && <p className={styles.verifyError}>{error}</p>}
    </form>
  );
}

// ─── Order complete celebration ───────────────────────────────────────────────

// Deterministic confetti so the burst is identical every render (no hydration
// or random-key churn). Brand palette only: red, deep red, gold, ink.
const CONFETTI = [
  { id: "c1", left: "8%", delay: "0ms", color: "#d64045", rot: "-18deg" },
  { id: "c2", left: "18%", delay: "90ms", color: "#e0a92e", rot: "24deg" },
  { id: "c3", left: "27%", delay: "40ms", color: "#0f0f0f", rot: "-8deg" },
  { id: "c4", left: "37%", delay: "150ms", color: "#f4b8ba", rot: "30deg" },
  { id: "c5", left: "46%", delay: "20ms", color: "#d64045", rot: "12deg" },
  { id: "c6", left: "55%", delay: "120ms", color: "#e0a92e", rot: "-26deg" },
  { id: "c7", left: "63%", delay: "60ms", color: "#b6353a", rot: "16deg" },
  { id: "c8", left: "71%", delay: "180ms", color: "#0f0f0f", rot: "-14deg" },
  { id: "c9", left: "80%", delay: "30ms", color: "#d64045", rot: "22deg" },
  { id: "c10", left: "88%", delay: "140ms", color: "#e0a92e", rot: "-20deg" },
  { id: "c11", left: "14%", delay: "210ms", color: "#f4b8ba", rot: "10deg" },
  { id: "c12", left: "33%", delay: "240ms", color: "#d64045", rot: "-30deg" },
  { id: "c13", left: "61%", delay: "260ms", color: "#b6353a", rot: "28deg" },
  { id: "c14", left: "77%", delay: "200ms", color: "#0f0f0f", rot: "-12deg" },
] as const;

function OrderComplete({ customerName }: { customerName: string }) {
  return (
    <div className={styles.complete} aria-live="polite" aria-atomic="true">
      <div className={styles.confetti} aria-hidden="true">
        {CONFETTI.map((c) => (
          <span
            key={c.id}
            className={styles.confettiPiece}
            style={
              {
                left: c.left,
                backgroundColor: c.color,
                animationDelay: c.delay,
                "--rot": c.rot,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.completeSeal}>
        <span className={styles.completeRing} aria-hidden="true" />
        <svg
          className={styles.completeCheck}
          viewBox="0 0 52 52"
          aria-hidden="true"
        >
          <circle
            className={styles.completeCheckCircle}
            cx="26"
            cy="26"
            r="25"
          />
          <path
            className={styles.completeCheckMark}
            fill="none"
            d="M15 27 l7.5 7.5 L37.5 19"
          />
        </svg>
      </div>

      <h3 className={styles.completeTitle}>Order complete!</h3>
      <p className={styles.completeText}>
        {customerName} picked up their order. Nicely done.
      </p>
      <p className={styles.completePayout}>
        Payment is on its way to your account.
      </p>
    </div>
  );
}

// ─── Confirmation dialog ──────────────────────────────────────────────────────

// Guards every cook action that changes an order's state so an accidental tap
// never silently advances (or reverts) an order.
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  tone = "default",
  confirmDisabled = false,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  tone?: "default" | "danger";
  // When true the confirm button is blocked (e.g. a required field is unfilled).
  confirmDisabled?: boolean;
  // Optional extra content (e.g. the delivery arrival-time step) shown between
  // the message and the action buttons.
  children?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div className={styles.confirmRoot} role="presentation">
      <button
        type="button"
        aria-label="Cancel"
        className={styles.confirmOverlay}
        onClick={() => !busy && onClose()}
      />
      <div
        className={`${styles.confirmModal} ${children ? styles.confirmModalWide : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <h3 id="confirm-title" className={styles.confirmTitle}>
          {title}
        </h3>
        <p
          id="confirm-message"
          className={`${styles.confirmText} ${children ? styles.confirmTextTight : ""}`}
        >
          {message}
        </p>
        {children}
        <div className={styles.confirmBtns}>
          <button
            type="button"
            className={`${styles.confirmYes} ${tone === "danger" ? styles.confirmYesDanger : ""}`}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? <Spinner label="Saving" /> : confirmLabel}
          </button>
          <button
            type="button"
            className={styles.confirmNo}
            onClick={onClose}
            disabled={busy}
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}

// The delivery "mark ready" step: read-only address + a required arrival-time
// picker constrained to the order's snapshotted delivery window.
function DeliveryReadyStep({
  order,
  value,
  onChange,
}: {
  order: Order;
  value: string;
  onChange: (iso: string) => void;
}) {
  const addr = addressLines(order.deliveryAddress);
  const slots = arrivalSlots(
    order.fulfillmentWindowStart,
    order.fulfillmentWindowEnd,
  );

  return (
    <div className={styles.readyStep}>
      <p className={styles.readyStepMeta}>
        <Truck size={14} aria-hidden="true" />
        <span>{formatTime(order)}</span>
      </p>

      {addr && (
        <div className={styles.addrBlock}>
          <span className={styles.addrLabel}>
            <MapPin size={13} aria-hidden="true" />
            Deliver to
          </span>
          <p className={styles.addrText}>
            {addr[0]}
            {addr[1] && (
              <>
                <br />
                {addr[1]}
              </>
            )}
          </p>
        </div>
      )}

      <div className={styles.arrivalField}>
        <label htmlFor="arrival-time" className={styles.arrivalLabel}>
          Your estimated arrival{" "}
          <span className={styles.arrivalReq} aria-hidden="true">
            *
          </span>
        </label>
        {slots.length > 0 ? (
          <div className={styles.arrivalSelectWrap}>
            <select
              id="arrival-time"
              className={`${styles.arrivalSelect} ${!value ? styles.arrivalSelectEmpty : ""}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="" disabled>
                Select a time
              </option>
              {slots.map((slot) => {
                const iso = slot.toISOString();
                return (
                  <option key={iso} value={iso}>
                    {formatSlotClock(slot)}
                  </option>
                );
              })}
            </select>
          </div>
        ) : (
          <p className={styles.arrivalNote}>
            No delivery window on file for this order — please contact the
            customer to arrange a time.
          </p>
        )}
        <p className={styles.arrivalHelp}>
          Pick a time within the customer&apos;s window. They&apos;ll see
          &ldquo;around&rdquo; this time when you mark ready.
        </p>
      </div>
    </div>
  );
}

// Copy for each state-changing action, keyed off the action and current status.
function advanceDialogCopy(
  status: OrderStatus,
  isDelivery: boolean,
): {
  title: string;
  message: string;
  confirmLabel: string;
} {
  if (status === "pending") {
    return {
      title: "Confirm this order?",
      message:
        "The customer will be notified that you've accepted their order. You won't be able to send it back to pending. Until you confirm, they can cancel anytime for a full refund. After you confirm, cancellations follow your refund policy in Settings.",
      confirmLabel: "Yes, confirm order",
    };
  }
  if (isDelivery) {
    return {
      title: "Mark order as ready?",
      message:
        "The customer gets a delivery code and a notification that you're on the way.",
      confirmLabel: "Yes, mark ready",
    };
  }
  return {
    title: "Mark order as ready?",
    message:
      "The customer will receive a pickup code and be notified their order is ready for pickup.",
    confirmLabel: "Yes, mark ready",
  };
}

// ─── Order detail ─────────────────────────────────────────────────────────────

function OrderDetail({
  order,
  onStatusChange,
  onClose,
}: {
  order: Order;
  onStatusChange: (id: string, newStatus: OrderStatus) => void;
  onClose?: () => void;
}) {
  const [cancelConfirm, setCancelConfirm] = useState(false);
  // Pending state-changing action awaiting confirmation in the popup.
  const [confirmAction, setConfirmAction] = useState<
    "advance" | "revert" | null
  >(null);
  const [mutating, setMutating] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  // True only when this cook just verified the code in-session, so the
  // celebration plays once on the action — not every time a completed order
  // is reopened.
  const [justFulfilled, setJustFulfilled] = useState(false);
  const canCancel = order.status === "pending" || order.status === "confirmed";
  const canAdvance = order.status === "pending" || order.status === "confirmed";
  // A confirmed order can only be marked ready from the day before fulfillment.
  // Block the action (and explain why) until then so the customer's pickup code
  // isn't issued days early and left to expire before they arrive.
  const readyTooEarly = order.status === "confirmed" && !canMarkReady(order);
  const readyFrom = readyTooEarly ? readyAvailableFrom(order) : null;
  const isDelivery = order.fulfillmentMode === "delivery";
  // Cook's chosen arrival time (ISO) for the delivery "mark ready" step.
  const [arrivalAt, setArrivalAt] = useState("");

  const hasDishes = !!order.dishes && order.dishes.length > 0;
  const subtotal = dishesSubtotal(order.dishes);
  const deliveryFee = Number.parseFloat(order.deliveryFeeSnapshot ?? "0");
  const platformDiscount = Number.parseFloat(
    order.platformDiscountAmount ?? "0",
  );
  const tax = Number.parseFloat(order.taxAmount ?? "0");
  const total = Number.parseFloat(order.totalPrice ?? "0");
  const platformFee = Number.parseFloat(order.platformFeeAmount ?? "0");
  const feePctLabel =
    order.platformFeePct != null
      ? `${Number.parseFloat(order.platformFeePct)}%`
      : null;
  const cookEarns =
    order.cookPayoutAmount != null
      ? Number.parseFloat(order.cookPayoutAmount)
      : Number.isFinite(total)
        ? Math.max(0, Math.round((total - platformFee - tax) * 100) / 100)
        : null;
  const showEarnBreakdown = order.cookPayoutAmount != null;
  const totalItems =
    order.dishes?.reduce((sum, d) => sum + d.quantity, 0) ??
    order.itemCount ??
    order.quantity ??
    0;

  async function patchStatus(
    status: "confirmed" | "ready" | "cancelled",
    arrivalAt?: string,
  ) {
    setMutating(true);
    try {
      const res = await fetch(
        `/api/business/dashboard/orders/${order.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(arrivalAt ? { status, arrivalAt } : { status }),
        },
      );
      if (res.ok) onStatusChange(order.id, status);
    } finally {
      setMutating(false);
    }
  }

  // Runs the confirmed action, then dismisses the popup.
  async function handleConfirmAction() {
    if (confirmAction === "advance") {
      const next = nextStatus(order.status);
      if (next) {
        // Delivery orders carry the cook's chosen arrival time into "ready".
        const arrival = next === "ready" && isDelivery ? arrivalAt : undefined;
        await patchStatus(next, arrival);
      }
    } else if (confirmAction === "revert") {
      await patchStatus("confirmed");
    }
    setConfirmAction(null);
    setArrivalAt("");
  }

  async function handleCancel() {
    await patchStatus("cancelled");
    setCancelConfirm(false);
  }

  return (
    <div className={styles.detail}>
      {onClose && (
        <>
          <button type="button" className={styles.detailBack} onClick={onClose}>
            <ArrowLeft size={18} aria-hidden="true" />
            Back to orders
          </button>
          <button
            type="button"
            className={styles.detailClose}
            onClick={onClose}
            aria-label="Close order details"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </>
      )}

      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderTop}>
          <h2
            className={styles.detailTitle}
            title={cookClientDisplayName(order)}
          >
            <CustomerName order={order} />
          </h2>
          <StatusBadge status={order.status} />
        </div>
        <p className={styles.detailSubMeta}>
          {fulfillmentLabel(order)} order &middot; {totalItems} item
          {totalItems === 1 ? "" : "s"}
        </p>
      </div>

      <div className={styles.timeCard}>
        <span className={styles.timeCardLabel}>{fulfillmentLabel(order)}</span>
        <span className={styles.timeCardValue}>{formatTime(order)}</span>
      </div>

      {isDelivery &&
        (() => {
          const addr = addressLines(order.deliveryAddress);
          if (!addr) return null;
          return (
            <div className={styles.deliverToCard}>
              <span className={styles.deliverToLabel}>
                <MapPin size={13} aria-hidden="true" />
                Deliver to
              </span>
              <p className={styles.deliverToText}>
                {addr[0]}
                {addr[1] && (
                  <>
                    <br />
                    {addr[1]}
                  </>
                )}
              </p>
              {order.deliveryDetails && (
                <p className={styles.deliveryDetailsText}>
                  {order.deliveryDetails}
                </p>
              )}
            </div>
          );
        })()}

      <div className={styles.detailActions}>
        <button
          type="button"
          className={styles.prefsBtn}
          onClick={() => setPrefsOpen(true)}
        >
          <ClipboardList size={15} />
          Preferences
        </button>
      </div>

      <div className={styles.receipt}>
        <p className={styles.receiptLabel}>Order summary</p>

        {hasDishes ? (
          <div className={styles.receiptItems}>
            {order.dishes?.map((d) => {
              const discount = Number.parseFloat(d.discountAmount ?? "0");
              return (
                <div key={d.id} className={styles.receiptRow}>
                  <span className={styles.receiptQty}>{d.quantity}&times;</span>
                  <div className={styles.receiptItemMain}>
                    <span className={styles.receiptItemName}>{d.dishName}</span>
                    <span className={styles.receiptItemUnit}>
                      {money(d.priceSnapshot)} each
                      {discount > 0 && (
                        <span className={styles.receiptPromo}>
                          {" "}
                          &middot; &minus;{money(discount)} promo
                        </span>
                      )}
                    </span>
                  </div>
                  <span className={styles.receiptLineTotal}>
                    {money(d.lineTotal)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className={styles.receiptTotals}>
          {hasDishes && (
            <div className={styles.receiptTotalRow}>
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
          )}
          {deliveryFee > 0 && (
            <div className={styles.receiptTotalRow}>
              <span>Delivery</span>
              <span>{money(deliveryFee)}</span>
            </div>
          )}
          {platformDiscount > 0 && (
            <div className={styles.receiptTotalRow}>
              <span>Platform discount</span>
              <span>&minus;{money(platformDiscount)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className={styles.receiptTotalRow}>
              <span>Tax</span>
              <span>{money(tax)}</span>
            </div>
          )}
          <div
            className={`${styles.receiptTotalRow} ${styles.receiptGrandTotal}`}
          >
            <span>Customer total</span>
            <span>{money(order.totalPrice)}</span>
          </div>
          {platformDiscount > 0 && (
            <p className={styles.receiptDiscountNote}>
              7eats covers this discount. It comes out of our platform fee, not
              your cut, so your payout is the same as a full-price order.
            </p>
          )}
          {cookEarns != null && (
            <>
              {showEarnBreakdown && (
                <>
                  <div className={styles.receiptTotalRow}>
                    <span>
                      Platform fee{feePctLabel ? ` (${feePctLabel})` : ""}
                    </span>
                    <span className={styles.payoutDeduct}>
                      &minus;{money(platformFee)}
                    </span>
                  </div>
                  {tax > 0 && (
                    <div className={styles.receiptTotalRow}>
                      <span>Tax remitted</span>
                      <span className={styles.payoutDeduct}>
                        &minus;{money(tax)}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div
                className={`${styles.receiptTotalRow} ${styles.cookEarnRow}`}
              >
                <span>You earn</span>
                <span>{money(cookEarns)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {order.notes && (
        <div className={styles.notesBlock}>
          <p className={styles.notesLabel}>Customer note</p>
          <p className={styles.notesText}>{order.notes}</p>
        </div>
      )}

      {order.status === "ready" && (
        <div className={styles.actionZone}>
          <VerifyCode
            orderId={order.id}
            initialAttempts={order.pickupCodeAttempts}
            onVerify={() => {
              setJustFulfilled(true);
              onStatusChange(order.id, "fulfilled");
            }}
          />
          <div className={styles.revertBlock}>
            <span className={styles.revertPrompt}>Still preparing?</span>
            <button
              type="button"
              className={styles.revertBtn}
              onClick={() => setConfirmAction("revert")}
              disabled={mutating}
            >
              Mark as not ready
            </button>
          </div>
        </div>
      )}

      {(canAdvance || canCancel) && (
        <div className={styles.actionZone}>
          {cancelConfirm ? (
            <div className={styles.cancelConfirm}>
              <div className={styles.cancelConfirmHead}>
                <AlertTriangle
                  size={18}
                  className={styles.cancelConfirmIcon}
                  aria-hidden="true"
                />
                <p className={styles.cancelConfirmTitle}>Cancel this order?</p>
              </div>
              <p className={styles.cancelConfirmText}>
                {order.status === "pending"
                  ? "The customer will be fully refunded and notified. Only cancel if you cannot take this order."
                  : "You've already confirmed this order. The customer will be fully refunded and notified."}
              </p>
              <p className={styles.cancelConfirmWarn}>This cannot be undone.</p>
              <div className={styles.cancelConfirmBtns}>
                <button
                  type="button"
                  className={styles.cancelConfirmYes}
                  onClick={handleCancel}
                  disabled={mutating}
                >
                  {mutating ? (
                    <Spinner label="Cancelling order" />
                  ) : (
                    "Yes, cancel order"
                  )}
                </button>
                <button
                  type="button"
                  className={styles.cancelConfirmNo}
                  onClick={() => setCancelConfirm(false)}
                  disabled={mutating}
                >
                  Go back
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.actionBtns}>
              {canAdvance && (
                <button
                  type="button"
                  className={styles.advanceBtn}
                  onClick={() => setConfirmAction("advance")}
                  disabled={mutating || readyTooEarly}
                >
                  {ACTION_LABEL[order.status]}
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setCancelConfirm(true)}
                >
                  <AlertTriangle size={14} aria-hidden="true" />
                  Cancel order
                </button>
              )}
            </div>
          )}
          {readyTooEarly && (
            <p className={styles.readyHint}>
              You can mark this order ready starting{" "}
              {readyFrom
                ? readyFrom.toLocaleDateString("en-CA", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })
                : "the day before"}{" "}
              the day before the scheduled{" "}
              {fulfillmentLabel(order).toLowerCase()}. This keeps the
              customer&apos;s pickup code from expiring before they arrive.
            </p>
          )}
        </div>
      )}

      {order.status === "fulfilled" &&
        (justFulfilled ? (
          <OrderComplete customerName={cookClientDisplayName(order)} />
        ) : (
          <div className={styles.completedCalm}>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>Order complete</span>
          </div>
        ))}

      {order.status === "cancelled" && (
        <div className={styles.statusNote}>This order was cancelled.</div>
      )}

      {confirmAction === "revert" ? (
        <ConfirmDialog
          title="Mark as not ready?"
          message="We'll let the customer know their order isn't ready yet. Their current pickup code will stop working until you mark it ready again."
          confirmLabel="Yes, not ready"
          busy={mutating}
          onConfirm={handleConfirmAction}
          onClose={() => setConfirmAction(null)}
        />
      ) : confirmAction === "advance" ? (
        <ConfirmDialog
          {...advanceDialogCopy(order.status, isDelivery)}
          busy={mutating}
          confirmDisabled={
            order.status === "confirmed" && isDelivery && !arrivalAt
          }
          onConfirm={handleConfirmAction}
          onClose={() => {
            setConfirmAction(null);
            setArrivalAt("");
          }}
        >
          {order.status === "confirmed" && isDelivery && (
            <DeliveryReadyStep
              order={order}
              value={arrivalAt}
              onChange={setArrivalAt}
            />
          )}
        </ConfirmDialog>
      ) : null}

      <PreferenceSheet
        clientId={order.clientId}
        clientName={cookClientDisplayName(order)}
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
      />
    </div>
  );
}

// ─── Order list row ───────────────────────────────────────────────────────────

function OrderListRow({
  order,
  focused,
  onSelect,
}: {
  order: Order;
  focused: boolean;
  onSelect: () => void;
}) {
  const itemCount = order.itemCount ?? order.quantity ?? 0;
  return (
    <button
      type="button"
      className={`${styles.listRow} ${order.status === "pending" ? styles.listRowPending : ""} ${focused ? styles.listRowFocused : ""}`}
      onClick={onSelect}
    >
      <div className={styles.listRowLeft}>
        <CustomerName order={order} className={styles.listRowCustomer} />
        <span className={styles.listRowMeta}>
          {formatTime(order)} &middot;{" "}
          <span className={styles.listRowQty}>
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>{" "}
          &middot; {money(order.totalPrice)}
        </span>
      </div>
      <StatusBadge status={order.status} />
    </button>
  );
}

// ─── Empty detail ─────────────────────────────────────────────────────────────

function EmptyDetail() {
  return (
    <div className={styles.emptyDetail}>Select an order to view details</div>
  );
}

// ─── Loading skeletons ────────────────────────────────────────────────────────

// One list row placeholder — mirrors OrderListRow (two stacked lines + badge).
function ListRowSkeleton() {
  return (
    <div className={styles.listRow} aria-hidden="true">
      <div
        className={styles.listRowLeft}
        style={{ display: "flex", flexDirection: "column", gap: 7 }}
      >
        <Skeleton width="45%" height={14} radius={6} />
        <Skeleton width="72%" height={11} radius={6} />
      </div>
      <Skeleton width={64} height={22} radius={11} />
    </div>
  );
}

// Detail-panel placeholder — echoes the header, time card and receipt block so
// the panel holds its shape while the selected order loads.
function DetailSkeleton() {
  return (
    <div className={styles.detail} aria-hidden="true">
      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderTop}>
          <Skeleton width="50%" height={22} radius={6} />
          <Skeleton width={72} height={24} radius={12} />
        </div>
        <Skeleton
          width="40%"
          height={12}
          radius={6}
          style={{ marginTop: 10 }}
        />
      </div>
      <div className={styles.timeCard}>
        <Skeleton width="30%" height={11} radius={6} />
        <Skeleton width="55%" height={16} radius={6} style={{ marginTop: 8 }} />
      </div>
      <div className={styles.receipt}>
        <Skeleton width="35%" height={11} radius={6} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginTop: 16,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <Skeleton width={20} height={14} radius={4} />
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <Skeleton width="60%" height={13} radius={6} />
                <Skeleton width="35%" height={11} radius={6} />
              </div>
              <Skeleton width={48} height={14} radius={6} />
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid var(--grey-200)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Skeleton width="100%" height={14} radius={6} />
          <Skeleton width="100%" height={14} radius={6} />
          <Skeleton
            width="55%"
            height={20}
            radius={6}
            style={{ marginTop: 4 }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusedDetail, setFocusedDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [slideOpen, setSlideOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/business/dashboard/orders?limit=100");
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data ?? []);
        // Auto-focus first pending order
        const firstPending = (json.data ?? []).find(
          (o: Order) => o.status === "pending",
        );
        if (firstPending) setFocusedId((prev) => prev ?? firstPending.id);
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Deep-link support: /business/orders?order=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("order");
    if (id) {
      setFocusedId(id);
      setSlideOpen(true);
    }
  }, []);

  // Fetch order detail (with dishes + payout) when selection changes.
  useEffect(() => {
    if (!focusedId) {
      setFocusedDetail(null);
      return;
    }
    setFocusedDetail(null);
    setDetailLoading(true);
    fetch(`/api/business/dashboard/orders/${focusedId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setFocusedDetail(json.data);
      })
      .finally(() => setDetailLoading(false));
  }, [focusedId]);

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  const sorted = [...orders].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return 0;
  });

  function handleSelect(id: string) {
    setFocusedId(id);
    setSlideOpen(true);
  }

  function handleStatusChange(id: string, newStatus: OrderStatus) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o)),
    );
    if (focusedDetail?.id === id) {
      setFocusedDetail((prev) =>
        prev ? { ...prev, status: newStatus } : prev,
      );
    }
  }

  const displayedDetail =
    focusedDetail ?? orders.find((o) => o.id === focusedId) ?? null;

  return (
    <div className={styles.page}>
      {/* Left: order list */}
      <div className={styles.listPanel}>
        <div className={styles.listHead}>
          <div className={styles.listHeadLeft}>
            <span className={styles.listTitle}>Orders</span>
            {pendingCount > 0 && (
              <span className={styles.listNeedsAction}>{pendingCount} new</span>
            )}
          </div>
          <span className={styles.listHeadCount}>{orders.length}</span>
        </div>

        {loading && [0, 1, 2, 3, 4].map((i) => <ListRowSkeleton key={i} />)}

        {sorted.map((o) => (
          <OrderListRow
            key={o.id}
            order={o}
            focused={focusedId === o.id}
            onSelect={() => handleSelect(o.id)}
          />
        ))}
      </div>

      {/* Right: detail panel (desktop) */}
      <div className={styles.detailPanel}>
        {detailLoading ? (
          <DetailSkeleton />
        ) : displayedDetail ? (
          <OrderDetail
            key={focusedId}
            order={displayedDetail}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <EmptyDetail />
        )}
      </div>

      {/* Mobile slide-over */}
      {slideOpen && displayedDetail && (
        <>
          <button
            type="button"
            aria-label="Close"
            className={styles.slideOverlay}
            onClick={() => setSlideOpen(false)}
          />
          <div className={styles.slideOver}>
            <OrderDetail
              key={focusedId}
              order={displayedDetail}
              onStatusChange={handleStatusChange}
              onClose={() => setSlideOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
