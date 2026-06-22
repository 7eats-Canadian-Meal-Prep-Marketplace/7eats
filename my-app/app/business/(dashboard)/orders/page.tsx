"use client";

import { CheckCircle2, ClipboardList, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PreferenceSheet } from "../_components/PreferenceSheet";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "pending"
  | "confirmed"
  | "ready"
  | "fulfilled"
  | "cancelled";

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

type Order = {
  id: string;
  status: OrderStatus;
  clientId: string | null;
  customerName: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  listingTitle: string | null;
  // Deprecated order-level fields — null for current multi-dish orders.
  quantity: number | null;
  unitPrice: string | null;
  // Derived in the list endpoint from order_dishes (total items in the order).
  itemCount?: number;
  totalPrice: string;
  taxAmount: string | null;
  deliveryFeeSnapshot: string | null;
  fulfillmentMode: string | null;
  pickupAt: string | null;
  fulfillmentWindowStart: string | null;
  fulfillmentWindowEnd: string | null;
  notes: string | null;
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

function dishesSubtotal(dishes: DishSnapshot[] | undefined): number {
  if (!dishes) return 0;
  return dishes.reduce(
    (sum, d) => sum + Number.parseFloat(d.lineTotal ?? "0"),
    0,
  );
}

function customerDisplay(order: Order): string {
  if (order.customerFirstName)
    return (
      order.customerFirstName +
      (order.customerName?.split(" ")[1]
        ? ` ${order.customerName.split(" ")[1]}`
        : "")
    );
  if (order.customerName) return order.customerName;
  return "Customer";
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
            : `Incorrect — ${remaining} attempt${remaining === 1 ? "" : "s"} left`,
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
          {submitting ? "…" : "Verify"}
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
  const [mutating, setMutating] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  // True only when this cook just verified the code in-session, so the
  // celebration plays once on the action — not every time a completed order
  // is reopened.
  const [justFulfilled, setJustFulfilled] = useState(false);
  const canCancel = order.status === "pending" || order.status === "confirmed";
  const canAdvance = order.status === "pending" || order.status === "confirmed";

  const hasDishes = !!order.dishes && order.dishes.length > 0;
  const subtotal = dishesSubtotal(order.dishes);
  const deliveryFee = Number.parseFloat(order.deliveryFeeSnapshot ?? "0");
  const tax = Number.parseFloat(order.taxAmount ?? "0");
  const totalItems =
    order.dishes?.reduce((sum, d) => sum + d.quantity, 0) ??
    order.itemCount ??
    order.quantity ??
    0;

  async function patchStatus(status: "confirmed" | "ready" | "cancelled") {
    setMutating(true);
    try {
      const res = await fetch(
        `/api/business/dashboard/orders/${order.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (res.ok) onStatusChange(order.id, status);
    } finally {
      setMutating(false);
    }
  }

  async function handleRevert() {
    await patchStatus("confirmed");
  }

  async function handleAdvance() {
    const next = nextStatus(order.status);
    if (next) await patchStatus(next);
  }

  async function handleCancel() {
    await patchStatus("cancelled");
    setCancelConfirm(false);
  }

  return (
    <div className={styles.detail}>
      {onClose && (
        <button
          type="button"
          className={styles.detailClose}
          onClick={onClose}
          aria-label="Close order details"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}

      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderTop}>
          <h2 className={styles.detailTitle} title={customerDisplay(order)}>
            {customerDisplay(order)}
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
          {tax > 0 && (
            <div className={styles.receiptTotalRow}>
              <span>Tax</span>
              <span>{money(tax)}</span>
            </div>
          )}
          <div
            className={`${styles.receiptTotalRow} ${styles.receiptGrandTotal}`}
          >
            <span>Total</span>
            <span>{money(order.totalPrice)}</span>
          </div>
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
              onClick={handleRevert}
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
              <p className={styles.cancelConfirmText}>
                Cancel this order? This cannot be undone.
              </p>
              <div className={styles.cancelConfirmBtns}>
                <button
                  type="button"
                  className={styles.cancelConfirmYes}
                  onClick={handleCancel}
                  disabled={mutating}
                >
                  Yes, cancel order
                </button>
                <button
                  type="button"
                  className={styles.cancelConfirmNo}
                  onClick={() => setCancelConfirm(false)}
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
                  onClick={handleAdvance}
                  disabled={mutating}
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
                  Cancel order
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {order.status === "fulfilled" &&
        (justFulfilled ? (
          <OrderComplete customerName={customerDisplay(order)} />
        ) : (
          <div className={styles.completedCalm}>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>Order complete</span>
          </div>
        ))}

      {order.status === "cancelled" && (
        <div className={styles.statusNote}>This order was cancelled.</div>
      )}

      <PreferenceSheet
        clientId={order.clientId}
        clientName={customerDisplay(order)}
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
        <span className={styles.listRowCustomer}>{customerDisplay(order)}</span>
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

  // Fetch order detail (with dishes) when selection changes
  useEffect(() => {
    if (!focusedId) return;
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

        {loading && (
          <div className={styles.emptyDetail} style={{ padding: "2rem" }}>
            Loading orders…
          </div>
        )}

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
          <div className={styles.emptyDetail}>Loading…</div>
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
