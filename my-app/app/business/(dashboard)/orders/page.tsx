"use client";

import { ClipboardList, MessageSquare, X } from "lucide-react";
import Link from "next/link";
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
  sortOrder: number;
};

type Order = {
  id: string;
  status: OrderStatus;
  clientId: string | null;
  customerName: string | null;
  customerFirstName: string | null;
  listingTitle: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  pickupAt: string;
  notes: string | null;
  pickupCodeAttempts: number;
  createdAt: string;
  dishes?: DishSnapshot[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  if (d.toDateString() === yesterday.toDateString())
    return `Yesterday · ${time}`;
  return `${d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
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
  const canCancel = order.status === "pending" || order.status === "confirmed";
  const canAdvance = order.status === "pending" || order.status === "confirmed";

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
        <button type="button" className={styles.detailClose} onClick={onClose}>
          <X size={16} />
        </button>
      )}

      <div className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>{order.listingTitle ?? "Order"}</h2>
        <div className={styles.detailSubline}>
          <span className={styles.detailCustomer}>
            {customerDisplay(order)}
          </span>
          <span className={styles.detailDot}>·</span>
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className={styles.detailActions}>
        <Link href="/business/inbox" className={styles.chatBtn}>
          <MessageSquare size={15} />
          Message customer
        </Link>
        <button
          type="button"
          className={styles.prefsBtn}
          onClick={() => setPrefsOpen(true)}
        >
          <ClipboardList size={15} />
          Preferences
        </button>
      </div>

      <div className={styles.metaBlock}>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>Pickup</span>
          <span className={styles.metaVal}>{formatTime(order.pickupAt)}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>Quantity</span>
          <span className={styles.metaVal}>{order.quantity}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>Unit price</span>
          <span className={styles.metaVal}>${order.unitPrice}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>Total</span>
          <span className={`${styles.metaVal} ${styles.metaValBold}`}>
            ${order.totalPrice}
          </span>
        </div>
        {order.notes && (
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>Note</span>
            <span className={styles.metaVal}>{order.notes}</span>
          </div>
        )}
      </div>

      {order.dishes && order.dishes.length > 0 && (
        <div className={styles.dishSection}>
          <p className={styles.dishSectionLabel}>What&apos;s included</p>
          {order.dishes.map((d) => (
            <div key={d.id} className={styles.dishRow}>
              <span className={styles.dishName}>{d.dishName}</span>
              <span className={styles.dishQtyBox}>{d.quantity}</span>
            </div>
          ))}
        </div>
      )}

      {order.status === "ready" && (
        <div className={styles.actionZone}>
          <VerifyCode
            orderId={order.id}
            initialAttempts={order.pickupCodeAttempts}
            onVerify={() => onStatusChange(order.id, "fulfilled")}
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

      {order.status === "fulfilled" && (
        <div className={styles.statusNote}>Order completed.</div>
      )}

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
  return (
    <button
      type="button"
      className={`${styles.listRow} ${order.status === "pending" ? styles.listRowPending : ""} ${focused ? styles.listRowFocused : ""}`}
      onClick={onSelect}
    >
      <div className={styles.listRowLeft}>
        <span className={styles.listRowCustomer}>{customerDisplay(order)}</span>
        <span className={styles.listRowListing}>
          {order.listingTitle ?? "Order"}
        </span>
        <span className={styles.listRowMeta}>
          {formatTime(order.pickupAt)} &middot;{" "}
          <span className={styles.listRowQty}>
            {order.quantity} item{order.quantity !== 1 ? "s" : ""}
          </span>{" "}
          &middot; ${order.totalPrice}
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
