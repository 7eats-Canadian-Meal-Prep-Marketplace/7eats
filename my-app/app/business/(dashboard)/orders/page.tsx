"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { MOCK_ORDERS, type MockOrder } from "./_mock";
import styles from "./page.module.css";

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

const STATUS_LABEL: Record<MockOrder["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready: "Ready",
  fulfilled: "Complete",
  cancelled: "Cancelled",
};

const ACTION_LABEL: Partial<Record<MockOrder["status"], string>> = {
  pending: "Confirm",
  confirmed: "Mark ready",
};

const BADGE_CLS: Record<MockOrder["status"], string> = {
  pending: styles.badgePending,
  confirmed: styles.badgeConfirmed,
  ready: styles.badgeReady,
  fulfilled: styles.badgeFulfilled,
  cancelled: styles.badgeCancelled,
};

function nextStatus(s: MockOrder["status"]): MockOrder["status"] | null {
  const map: Partial<Record<MockOrder["status"], MockOrder["status"]>> = {
    pending: "confirmed",
    confirmed: "ready",
    ready: "fulfilled",
  };
  return map[s] ?? null;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MockOrder["status"] }) {
  return (
    <span className={`${styles.badge} ${BADGE_CLS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Pickup code verification ─────────────────────────────────────────────────

function VerifyCode({
  pickupCode,
  onVerify,
}: {
  pickupCode: string;
  onVerify: () => void;
}) {
  const [code, setCode] = useState("");
  const [attempts, setAttempts] = useState(0);
  const locked = attempts >= 3;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code === pickupCode) {
      onVerify();
    } else {
      setAttempts((a) => a + 1);
      setCode("");
    }
  }

  if (locked) {
    return (
      <div className={styles.verifyLocked}>
        Code entry locked after 3 failed attempts.
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
          disabled={code.length < 6}
        >
          Verify
        </button>
      </div>
      {attempts > 0 && (
        <p className={styles.verifyError}>
          Incorrect —{" "}
          {3 - attempts === 1 ? "1 attempt" : `${3 - attempts} attempts`} left
        </p>
      )}
    </form>
  );
}

// ─── Order detail ─────────────────────────────────────────────────────────────

function OrderDetail({
  order,
  onAdvance,
  onCancel,
  onClose,
}: {
  order: MockOrder;
  onAdvance: (id: string) => void;
  onCancel: (id: string) => void;
  onClose?: () => void;
}) {
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const canCancel = order.status === "pending" || order.status === "confirmed";
  const canAdvance = order.status === "pending" || order.status === "confirmed";

  return (
    <div className={styles.detail}>
      {onClose && (
        <button type="button" className={styles.detailClose} onClick={onClose}>
          <X size={16} />
        </button>
      )}

      <div className={styles.detailHeader}>
        <StatusBadge status={order.status} />
        <h2 className={styles.detailTitle}>{order.listingTitle}</h2>
        <p className={styles.detailCustomer}>{order.customerName}</p>
      </div>

      <div className={styles.metaBlock}>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>Pickup</span>
          <span className={styles.metaVal}>{formatTime(order.pickupAt)}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>Quantity</span>
          <span className={styles.metaVal}>&times;{order.quantity}</span>
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

      <div className={styles.dishSection}>
        <p className={styles.dishSectionLabel}>What&apos;s included</p>
        {order.dishes.map((d) => (
          <div key={d.name} className={styles.dishRow}>
            <span className={styles.dishName}>{d.name}</span>
            <span className={styles.dishCuisine}>{d.cuisine}</span>
            <span className={styles.dishQty}>&times;{d.qty}</span>
          </div>
        ))}
      </div>

      {order.status === "ready" && (
        <div className={styles.actionZone}>
          <VerifyCode
            pickupCode={order.pickupCode}
            onVerify={() => onAdvance(order.id)}
          />
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
                  onClick={() => {
                    onCancel(order.id);
                    setCancelConfirm(false);
                  }}
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
                  onClick={() => onAdvance(order.id)}
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
    </div>
  );
}

// ─── Order list row ───────────────────────────────────────────────────────────

function OrderListRow({
  order,
  focused,
  onSelect,
  onAdvance,
}: {
  order: MockOrder;
  focused: boolean;
  onSelect: () => void;
  onAdvance: (id: string) => void;
}) {
  const action = ACTION_LABEL[order.status];

  return (
    <div
      className={`${styles.listRowWrap} ${order.status === "pending" ? styles.listRowPending : ""} ${focused ? styles.listRowFocused : ""}`}
    >
      <button type="button" className={styles.listRowBtn} onClick={onSelect}>
        <div className={styles.listRowTop}>
          <span className={styles.listRowCustomer}>{order.customerName}</span>
          <StatusBadge status={order.status} />
        </div>
        <div className={styles.listRowListing}>{order.listingTitle}</div>
        <div className={styles.listRowMeta}>
          {formatTime(order.pickupAt)} &middot; &times;{order.quantity} &middot;
          ${order.totalPrice}
        </div>
      </button>
      {action && (
        <button
          type="button"
          className={styles.listActionBtn}
          onClick={() => onAdvance(order.id)}
        >
          {action}
        </button>
      )}
    </div>
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
  const [orders, setOrders] = useState<MockOrder[]>(MOCK_ORDERS);
  const [focusedId, setFocusedId] = useState<string>(
    MOCK_ORDERS.find((o) => o.status === "pending")?.id ?? MOCK_ORDERS[0].id,
  );
  const [slideOpen, setSlideOpen] = useState(false);

  const focusedOrder = orders.find((o) => o.id === focusedId) ?? null;
  const pending = orders.filter((o) => o.status === "pending");
  const rest = orders.filter((o) => o.status !== "pending");

  function handleSelect(id: string) {
    setFocusedId(id);
    setSlideOpen(true);
  }

  function handleAdvance(id: string) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const n = nextStatus(o.status);
        return n ? { ...o, status: n } : o;
      }),
    );
  }

  function handleCancel(id: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "cancelled" } : o)),
    );
  }

  const detailProps = {
    onAdvance: handleAdvance,
    onCancel: handleCancel,
  };

  return (
    <div className={styles.page}>
      {/* Left: order list */}
      <div className={styles.listPanel}>
        <div className={styles.listHead}>
          <span className={styles.listTitle}>Orders</span>
          <span className={styles.listHeadCount}>{orders.length}</span>
        </div>

        {pending.length > 0 && (
          <div className={styles.listSection}>
            <div className={styles.sectionLabel}>Needs action</div>
            {pending.map((o) => (
              <OrderListRow
                key={o.id}
                order={o}
                focused={focusedId === o.id}
                onSelect={() => handleSelect(o.id)}
                onAdvance={handleAdvance}
              />
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <div className={styles.listSection}>
            <div className={styles.sectionLabel}>All orders</div>
            {rest.map((o) => (
              <OrderListRow
                key={o.id}
                order={o}
                focused={focusedId === o.id}
                onSelect={() => handleSelect(o.id)}
                onAdvance={handleAdvance}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right: detail panel (desktop) */}
      <div className={styles.detailPanel}>
        {focusedOrder ? (
          <OrderDetail key={focusedId} order={focusedOrder} {...detailProps} />
        ) : (
          <EmptyDetail />
        )}
      </div>

      {/* Mobile slide-over */}
      {slideOpen && focusedOrder && (
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
              order={focusedOrder}
              {...detailProps}
              onClose={() => setSlideOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
