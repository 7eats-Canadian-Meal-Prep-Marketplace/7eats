"use client";

import {
  AlertTriangle,
  Camera,
  GripVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { BackToListings } from "../_back-link";
import {
  MOCK_AVAILABLE_DISHES,
  MOCK_LISTING,
  MOCK_LISTING_DEALS,
  MOCK_LISTING_DISHES,
  MOCK_LISTING_ORDERS,
  type MockAvailableDish,
  type MockDealType,
  type MockListingDeal,
  type MockListingDish,
  type MockListingOrder,
} from "./_mock";
import styles from "./page.module.css";

type Tab = "overview" | "dishes" | "deals" | "orders";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDeal(deal: MockListingDeal): string {
  if (deal.type === "percentage_off") return `${deal.value}% off`;
  if (deal.type === "fixed_off") return `$${deal.value} off`;
  return `Buy ${deal.buyQty}, get ${deal.getQty} free`;
}

function daysLeft(validUntil: string | null): number | null {
  if (!validUntil) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(validUntil);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - now.getTime()) / 86_400_000);
  return diff >= 0 ? diff : null;
}

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
  return `${d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })} · ${time}`;
}

const STATUS_LABEL: Record<MockListingOrder["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready: "Ready",
  fulfilled: "Complete",
  cancelled: "Cancelled",
};

const BADGE_CLS: Record<MockListingOrder["status"], string> = {
  pending: styles.badgePending,
  confirmed: styles.badgeConfirmed,
  ready: styles.badgeReady,
  fulfilled: styles.badgeFulfilled,
  cancelled: styles.badgeCancelled,
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MockListingOrder["status"] }) {
  return (
    <span className={`${styles.badge} ${BADGE_CLS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const [form, setForm] = useState({
    title: MOCK_LISTING.title,
    description: MOCK_LISTING.description,
    basePrice: MOCK_LISTING.basePrice,
    currency: MOCK_LISTING.currency,
    minOrderQty: MOCK_LISTING.minOrderQty,
    maxOrderQty: MOCK_LISTING.maxOrderQty ?? "",
    status: MOCK_LISTING.status as "active" | "draft" | "archived",
  });
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className={styles.overviewTab}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total orders</span>
          <span className={styles.statVal}>{MOCK_LISTING.totalOrders}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total revenue</span>
          <span className={styles.statVal}>${MOCK_LISTING.totalRevenue}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Avg order value</span>
          <span className={styles.statVal}>${MOCK_LISTING.avgOrderValue}</span>
        </div>
      </div>

      <div className={styles.overviewColumns}>
        {/* Left — primary information (60%) */}
        <div className={styles.overviewLeft}>
          <div className={styles.formGroup}>
            <label htmlFor="f-title" className={styles.formLabel}>
              Title
            </label>
            <input
              id="f-title"
              type="text"
              className={styles.formInput}
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="f-description" className={styles.formLabel}>
              Description
            </label>
            <textarea
              id="f-description"
              className={styles.formTextarea}
              value={form.description}
              rows={5}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>

          <div className={styles.formRow3}>
            <div className={styles.formGroup}>
              <label htmlFor="f-base-price" className={styles.formLabel}>
                Base price
              </label>
              <div className={styles.priceWrap}>
                <span className={styles.pricePre}>$</span>
                <input
                  id="f-base-price"
                  type="text"
                  className={`${styles.formInput} ${styles.priceInput}`}
                  value={form.basePrice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, basePrice: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="f-min-qty" className={styles.formLabel}>
                Min dishes
              </label>
              <input
                id="f-min-qty"
                type="number"
                min={1}
                className={styles.formInput}
                value={form.minOrderQty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    minOrderQty: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="f-max-qty" className={styles.formLabel}>
                Max dishes
              </label>
              <input
                id="f-max-qty"
                type="number"
                min={1}
                className={styles.formInput}
                value={form.maxOrderQty}
                placeholder="No max"
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxOrderQty: e.target.value }))
                }
              />
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
            >
              {saved ? "Saved" : "Save changes"}
            </button>
          </div>
        </div>

        {/* Right — metadata & media (40%) */}
        <div className={styles.overviewRight}>
          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Cover photo</span>
            <div className={styles.dropzone}>
              <Camera size={20} className={styles.dropzoneIcon} />
              <span className={styles.dropzoneText}>
                Drag & drop, or{" "}
                <span className={styles.dropzoneBrowse}>browse</span>
              </span>
              <span className={styles.dropzoneSub}>
                JPEG, PNG or WEBP · Max 5 MB
              </span>
            </div>
          </div>

          <div className={styles.formRowSnug}>
            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Status</span>
              <div className={styles.segControl}>
                {(["active", "archived"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.segBtn} ${form.status === s ? styles.segBtnActive : ""}`}
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                  >
                    {s === "active" ? "Active" : "Archived"}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="f-currency" className={styles.formLabel}>
                Currency
              </label>
              <select
                id="f-currency"
                className={styles.formSelect}
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dishes tab ───────────────────────────────────────────────────────────────

function DishesTab() {
  const [dishes, setDishes] = useState<MockListingDish[]>(MOCK_LISTING_DISHES);
  const [showPicker, setShowPicker] = useState(false);
  const [removeBlocked, setRemoveBlocked] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  function handleDragOver(e: React.DragEvent<HTMLLIElement>, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    setDishes((prev) => {
      const from = prev.findIndex((d) => d.id === dragId);
      const to = prev.findIndex((d) => d.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleRemove(dish: MockListingDish) {
    if (dish.hasActiveOrders) {
      setRemoveBlocked(true);
      return;
    }
    setDishes((prev) => prev.filter((d) => d.id !== dish.id));
  }

  function handleAddDish(available: MockAvailableDish) {
    setDishes((prev) => [
      ...prev,
      { ...available, qty: 1, hasActiveOrders: false },
    ]);
    setShowPicker(false);
  }

  const pickerOptions = MOCK_AVAILABLE_DISHES.filter(
    (a) => !dishes.some((d) => d.id === a.id),
  );

  return (
    <div className={styles.dishesTab}>
      {removeBlocked && (
        <div className={styles.blockNotice}>
          <AlertTriangle size={15} className={styles.blockIcon} />
          <div className={styles.blockBody}>
            <span className={styles.blockTitle}>Can&apos;t remove dish</span>
            <span className={styles.blockDesc}>
              This dish is part of an open order. Remove it once all open orders
              are fulfilled or cancelled.
            </span>
          </div>
          <button
            type="button"
            className={styles.blockDismiss}
            onClick={() => setRemoveBlocked(false)}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <ul className={styles.dishList}>
        {dishes.map((dish) => (
          <li
            key={dish.id}
            className={`${styles.dishItem} ${dragId === dish.id ? styles.dishItemDragging : ""}`}
            draggable
            onDragStart={() => setDragId(dish.id)}
            onDragOver={(e) => handleDragOver(e, dish.id)}
            onDragEnd={() => setDragId(null)}
          >
            <span className={styles.dragHandle}>
              <GripVertical size={14} />
            </span>
            <div className={styles.dishInfo}>
              <span className={styles.dishName}>{dish.name}</span>
              <span className={styles.dishCuisine}>{dish.cuisine}</span>
            </div>
            <button
              type="button"
              className={styles.dishRemoveBtn}
              onClick={() => handleRemove(dish)}
              aria-label="Remove dish"
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}

        {dishes.length === 0 && (
          <li className={styles.emptyNote}>No dishes in this listing yet.</li>
        )}
      </ul>

      <button
        type="button"
        className={styles.addDishBtn}
        onClick={() => setShowPicker(true)}
      >
        <Plus size={14} />
        Add dish
      </button>

      {showPicker && (
        <div className={styles.pickerOverlay}>
          <div className={styles.pickerPanel}>
            <div className={styles.pickerHead}>
              <span className={styles.pickerTitle}>Add dish</span>
              <button
                type="button"
                className={styles.pickerClose}
                onClick={() => setShowPicker(false)}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
            {pickerOptions.length === 0 ? (
              <p className={styles.pickerEmpty}>
                All active dishes are already in this listing.
              </p>
            ) : (
              pickerOptions.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={styles.pickerRow}
                  onClick={() => handleAddDish(d)}
                >
                  <span className={styles.pickerName}>{d.name}</span>
                  <span className={styles.pickerCuisine}>{d.cuisine}</span>
                  <Plus size={13} className={styles.pickerPlus} />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deals tab ────────────────────────────────────────────────────────────────

const DEAL_TYPE_LABELS: [MockDealType, string][] = [
  ["percentage_off", "% Off"],
  ["fixed_off", "$ Off"],
  ["bogo", "Buy X Get Y"],
];

function DealsTab() {
  const [deals, setDeals] = useState<MockListingDeal[]>(MOCK_LISTING_DEALS);
  const [showForm, setShowForm] = useState(false);
  const [newDeal, setNewDeal] = useState({
    type: "percentage_off" as MockDealType,
    value: "",
    buyQty: "",
    getQty: "",
    validFrom: "",
    validUntil: "",
    maxUses: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  function deleteDeal(id: string) {
    setDeals((prev) => prev.filter((d) => d.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeal.validUntil && !newDeal.maxUses) {
      setFormError(
        "Set either an expiry date or a max redemption limit — a deal can't be unlimited.",
      );
      return;
    }
    setFormError(null);
    const deal: MockListingDeal = {
      id: `deal-${Date.now()}`,
      type: newDeal.type,
      value: Number(newDeal.value),
      buyQty: newDeal.buyQty ? Number(newDeal.buyQty) : null,
      getQty: newDeal.getQty ? Number(newDeal.getQty) : null,
      isActive: true,
      validFrom: newDeal.validFrom || null,
      validUntil: newDeal.validUntil || null,
      maxUses: newDeal.maxUses ? Number(newDeal.maxUses) : null,
      usesCount: 0,
    };
    setDeals((prev) => [...prev, deal]);
    setShowForm(false);
    setNewDeal({
      type: "percentage_off",
      value: "",
      buyQty: "",
      getQty: "",
      validFrom: "",
      validUntil: "",
      maxUses: "",
    });
  }

  return (
    <div className={styles.dealsTab}>
      <div className={styles.dealsToolbar}>
        <button
          type="button"
          className={styles.newDealBtn}
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus size={14} />
          New deal
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className={styles.dealForm}>
          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Type</span>
            <div className={styles.segControl}>
              {DEAL_TYPE_LABELS.map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.segBtn} ${newDeal.type === t ? styles.segBtnActive : ""}`}
                  onClick={() => setNewDeal((f) => ({ ...f, type: t }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {newDeal.type !== "bogo" && (
            <div className={styles.formGroup}>
              <label htmlFor="f-deal-value" className={styles.formLabel}>
                {newDeal.type === "percentage_off"
                  ? "Discount %"
                  : "Discount $"}
              </label>
              <input
                id="f-deal-value"
                type="number"
                min={1}
                max={newDeal.type === "percentage_off" ? 100 : undefined}
                className={styles.formInput}
                value={newDeal.value}
                onChange={(e) =>
                  setNewDeal((f) => ({ ...f, value: e.target.value }))
                }
                required
              />
            </div>
          )}

          {newDeal.type === "bogo" && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="f-deal-buy-qty" className={styles.formLabel}>
                  Buy qty
                </label>
                <input
                  id="f-deal-buy-qty"
                  type="number"
                  min={1}
                  className={styles.formInput}
                  value={newDeal.buyQty}
                  onChange={(e) =>
                    setNewDeal((f) => ({ ...f, buyQty: e.target.value }))
                  }
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="f-deal-get-qty" className={styles.formLabel}>
                  Get qty
                </label>
                <input
                  id="f-deal-get-qty"
                  type="number"
                  min={1}
                  className={styles.formInput}
                  value={newDeal.getQty}
                  onChange={(e) =>
                    setNewDeal((f) => ({ ...f, getQty: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="f-deal-valid-from" className={styles.formLabel}>
                Valid from (optional)
              </label>
              <input
                id="f-deal-valid-from"
                type="date"
                className={styles.formInput}
                value={newDeal.validFrom}
                onChange={(e) =>
                  setNewDeal((f) => ({ ...f, validFrom: e.target.value }))
                }
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="f-deal-valid-until" className={styles.formLabel}>
                Valid until
              </label>
              <input
                id="f-deal-valid-until"
                type="date"
                className={styles.formInput}
                value={newDeal.validUntil}
                onChange={(e) =>
                  setNewDeal((f) => ({ ...f, validUntil: e.target.value }))
                }
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="f-deal-max-uses" className={styles.formLabel}>
              Max redemptions
            </label>
            <input
              id="f-deal-max-uses"
              type="number"
              min={1}
              className={styles.formInput}
              value={newDeal.maxUses}
              placeholder="No limit"
              onChange={(e) =>
                setNewDeal((f) => ({ ...f, maxUses: e.target.value }))
              }
            />
          </div>

          {formError && <p className={styles.dealFormError}>{formError}</p>}

          <div className={styles.formActions}>
            <button type="submit" className={styles.saveBtn}>
              Create deal
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className={styles.dealsList}>
        {deals.map((deal) => {
          const d = daysLeft(deal.validUntil);
          return (
            <div key={deal.id} className={styles.dealItem}>
              <div className={styles.dealHeader}>
                <span className={styles.dealAmount}>{formatDeal(deal)}</span>
                {deal.usesCount === 0 && (
                  <button
                    type="button"
                    className={styles.deleteDealBtn}
                    onClick={() => deleteDeal(deal.id)}
                    aria-label="Delete deal"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className={styles.dealKV}>
                <div className={styles.dealKVItem}>
                  <span className={styles.dealKVKey}>Expires</span>
                  <span className={styles.dealKVVal}>
                    {deal.validUntil
                      ? new Date(deal.validUntil).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "No expiry"}
                  </span>
                </div>
                <div className={styles.dealKVItem}>
                  <span className={styles.dealKVKey}>Uses</span>
                  <span className={styles.dealKVVal}>
                    {deal.usesCount}
                    {deal.maxUses != null
                      ? ` / ${deal.maxUses}`
                      : " (unlimited)"}
                  </span>
                </div>
              </div>
              {d !== null && (
                <span
                  className={
                    d === 0
                      ? styles.dealDaysPillUrgent
                      : d <= 7
                        ? styles.dealDaysPillWarn
                        : styles.dealDaysPill
                  }
                >
                  {d === 0 ? "Expires today" : `${d}d left`}
                </span>
              )}
            </div>
          );
        })}

        {deals.length === 0 && (
          <div className={styles.emptyNote}>
            No deals yet. Create one above.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Orders tab ───────────────────────────────────────────────────────────────

function OrdersTab() {
  return (
    <div className={styles.ordersTab}>
      {MOCK_LISTING_ORDERS.map((order) => (
        <div key={order.id} className={styles.orderRow}>
          <div className={styles.orderMain}>
            <span className={styles.orderCustomer}>{order.customerName}</span>
            <span className={styles.orderMeta}>
              {formatTime(order.pickupAt)} &middot; {order.quantity}{" "}
              {order.quantity !== 1 ? "items" : "item"}
            </span>
          </div>
          <div className={styles.orderRight}>
            <span className={styles.orderTotal}>${order.totalPrice}</span>
            <StatusBadge status={order.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "dishes", label: "Dishes" },
  { id: "deals", label: "Deals" },
  { id: "orders", label: "Orders" },
];

export default function ListingDetailPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className={styles.page}>
      <BackToListings />
      <div className={styles.tabRow}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.content} key={tab}>
        {tab === "overview" && <OverviewTab />}
        {tab === "dishes" && <DishesTab />}
        {tab === "deals" && <DealsTab />}
        {tab === "orders" && <OrdersTab />}
      </div>
    </div>
  );
}
