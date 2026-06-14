"use client";

import {
  AlertTriangle,
  Camera,
  GripVertical,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  INTERVAL_LABELS,
  SUBSCRIPTION_INTERVALS,
  type SubscriptionInterval,
} from "@/lib/subscription-schedule";
import { BackToListings } from "../_back-link";
import {
  type AvailableDish,
  bundleToTier,
  type ListingDeal,
  ListingDetailProvider,
  type ListingDish,
  type ListingOrder,
  type PricingTier,
  type UiDealType,
  useListingDetail,
} from "./_listing-detail-context";
import styles from "./page.module.css";

type Tab = "overview" | "dishes" | "deals" | "orders" | "reviews";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDeal(deal: ListingDeal): string {
  if (deal.type === "percentage_off") return `${deal.value}% off`;
  return `$${deal.value} off`;
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

const STATUS_LABEL: Record<ListingOrder["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready: "Ready",
  fulfilled: "Complete",
  cancelled: "Cancelled",
};

const BADGE_CLS: Record<ListingOrder["status"], string> = {
  pending: styles.badgePending,
  confirmed: styles.badgeConfirmed,
  ready: styles.badgeReady,
  fulfilled: styles.badgeFulfilled,
  cancelled: styles.badgeCancelled,
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ListingOrder["status"] }) {
  return (
    <span className={`${styles.badge} ${BADGE_CLS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

type SubscriptionTierInput = { enabled: boolean; price: string };
type SubscriptionTierInputs = Record<
  SubscriptionInterval,
  SubscriptionTierInput
>;

const EMPTY_TIER_INPUTS: SubscriptionTierInputs = {
  weekly: { enabled: false, price: "" },
  biweekly: { enabled: false, price: "" },
  monthly: { enabled: false, price: "" },
};

function OverviewTab() {
  const {
    stats,
    listing,
    bundles,
    subscriptionTiers,
    saveOverview,
    saveSubscriptionTiers,
    loading,
  } = useListingDetail();
  const [form, setForm] = useState({
    title: "",
    description: "",
    basePrice: "",
    currency: "CAD",
    minOrderQty: 1,
    maxOrderQty: "" as string | number,
    status: "active" as "active" | "draft" | "archived",
  });
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [tierInputs, setTierInputs] =
    useState<SubscriptionTierInputs>(EMPTY_TIER_INPUTS);
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && listing && !initialized) {
      setForm({
        title: listing.title,
        description: listing.description,
        basePrice: listing.basePrice,
        currency: listing.currency,
        minOrderQty: listing.minOrderQty,
        maxOrderQty: listing.maxOrderQty ?? "",
        status: listing.status,
      });
      setSubscriptionEnabled(listing.subscriptionEnabled ?? false);
      setTiers(bundles.map(bundleToTier));
      const nextTierInputs: SubscriptionTierInputs = {
        weekly: { enabled: false, price: "" },
        biweekly: { enabled: false, price: "" },
        monthly: { enabled: false, price: "" },
      };
      for (const tier of subscriptionTiers) {
        nextTierInputs[tier.interval] = {
          enabled: tier.isActive,
          price: tier.price,
        };
      }
      setTierInputs(nextTierInputs);
      setInitialized(true);
    }
  }, [loading, listing, bundles, subscriptionTiers, initialized]);

  function addTier() {
    const nextQty =
      tiers.length > 0 ? Math.max(...tiers.map((t) => t.minQty)) + 5 : 5;
    setTiers((prev) => [
      ...prev,
      { id: `tier-${Date.now()}`, minQty: nextQty, pricePerUnit: "" },
    ]);
  }

  function removeTier(id: string) {
    setTiers((prev) => prev.filter((t) => t.id !== id));
  }

  function updateTierQty(id: string, qty: number) {
    if (Number.isNaN(qty)) return;
    setTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, minQty: qty } : t)),
    );
  }

  function clampTierQty(id: string) {
    setTiers((prev) => {
      const sorted = [...prev].sort((a, b) => a.minQty - b.minQty);
      const idx = sorted.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const lo = idx === 0 ? 2 : sorted[idx - 1].minQty + 1;
      const hi =
        idx < sorted.length - 1
          ? sorted[idx + 1].minQty - 1
          : Number.POSITIVE_INFINITY;
      const raw = sorted[idx].minQty;
      const clamped = Math.max(
        lo,
        Number.isFinite(hi) ? Math.min(hi, raw) : raw,
      );
      return prev.map((t) => (t.id === id ? { ...t, minQty: clamped } : t));
    });
  }

  function updateTierPrice(id: string, price: string) {
    setTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, pricePerUnit: price } : t)),
    );
  }

  function setSubscriptionTierInput(
    interval: SubscriptionInterval,
    update: Partial<SubscriptionTierInput>,
  ) {
    setTierInputs((prev) => ({
      ...prev,
      [interval]: { ...prev[interval], ...update },
    }));
  }

  async function handleSave() {
    const ok = await saveOverview({
      ...form,
      maxOrderQty: String(form.maxOrderQty),
      tiers,
      subscriptionEnabled,
    });
    if (!ok) return;
    if (subscriptionEnabled) {
      await saveSubscriptionTiers(
        SUBSCRIPTION_INTERVALS.map((interval) => ({
          interval,
          price: tierInputs[interval].price,
          enabled: tierInputs[interval].enabled,
        })),
      );
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading && !initialized) {
    return <p className={styles.emptyNote}>Loading listing…</p>;
  }

  return (
    <div className={styles.overviewTab}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total orders</span>
          <span className={styles.statVal}>{stats.totalOrders}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total revenue</span>
          <span className={styles.statVal}>${stats.totalRevenue}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Avg order value</span>
          <span className={styles.statVal}>${stats.avgOrderValue}</span>
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

          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Volume pricing</span>
            <div className={styles.tierTable}>
              <div className={styles.tierHeader}>
                <span className={styles.tierHeaderCell}>Min qty</span>
                <span className={styles.tierHeaderCell}>Price / unit</span>
                <span />
              </div>
              <div className={`${styles.tierRow} ${styles.tierBaseRow}`}>
                <div className={styles.tierQtyCell}>
                  <span className={styles.tierBaseText}>1+</span>
                </div>
                <div className={styles.tierPriceCell}>
                  <span className={styles.tierPricePre}>$</span>
                  <span className={styles.tierBaseText}>
                    {form.basePrice || "—"}
                  </span>
                </div>
                <div />
              </div>
              {[...tiers]
                .sort((a, b) => a.minQty - b.minQty)
                .map((tier) => (
                  <div key={tier.id} className={styles.tierRow}>
                    <div className={styles.tierQtyCell}>
                      <input
                        type="number"
                        min={2}
                        aria-label="Minimum quantity"
                        className={styles.tierQtyInput}
                        value={tier.minQty}
                        onChange={(e) =>
                          updateTierQty(tier.id, Number(e.target.value))
                        }
                        onBlur={() => clampTierQty(tier.id)}
                      />
                      <span className={styles.tierQtyPlus}>+</span>
                    </div>
                    <div className={styles.tierPriceCell}>
                      <span className={styles.tierPricePre}>$</span>
                      <input
                        type="text"
                        aria-label="Price per unit"
                        className={styles.tierPriceInput}
                        value={tier.pricePerUnit}
                        placeholder="0.00"
                        onChange={(e) =>
                          updateTierPrice(tier.id, e.target.value)
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.tierRemoveBtn}
                      onClick={() => removeTier(tier.id)}
                      aria-label="Remove tier"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
            </div>
            <button
              type="button"
              className={styles.addTierBtn}
              onClick={addTier}
            >
              <Plus size={13} />
              Add tier
            </button>
          </div>

          {/* Subscription toggle */}
          <div className={styles.subscriptionToggleRow}>
            <div className={styles.subscriptionToggleInfo}>
              <span className={styles.formLabel}>Accept subscriptions</span>
              <span className={styles.subscriptionToggleDesc}>
                Let customers subscribe and get this listing automatically on a
                recurring basis. They can cancel any time.
              </span>
            </div>
            <button
              type="button"
              className={`${styles.toggleSwitch} ${subscriptionEnabled ? styles.toggleSwitchOn : ""}`}
              onClick={() => setSubscriptionEnabled((v) => !v)}
              aria-label={
                subscriptionEnabled
                  ? "Disable subscriptions"
                  : "Enable subscriptions"
              }
              aria-pressed={subscriptionEnabled}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>

          {subscriptionEnabled && (
            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Subscription pricing</span>
              <div className={styles.subscriptionTiersBlock}>
                {SUBSCRIPTION_INTERVALS.map((interval) => (
                  <div key={interval} className={styles.subscriptionTierRow}>
                    <label className={styles.subscriptionTierCheck}>
                      <input
                        type="checkbox"
                        checked={tierInputs[interval].enabled}
                        onChange={(e) =>
                          setSubscriptionTierInput(interval, {
                            enabled: e.target.checked,
                          })
                        }
                      />
                      <span>{INTERVAL_LABELS[interval]}</span>
                    </label>
                    <div className={styles.priceWrap}>
                      <span className={styles.pricePre}>$</span>
                      <input
                        type="text"
                        aria-label={`${INTERVAL_LABELS[interval]} price`}
                        className={`${styles.formInput} ${styles.priceInput}`}
                        value={tierInputs[interval].price}
                        placeholder="0.00"
                        disabled={!tierInputs[interval].enabled}
                        onChange={(e) =>
                          setSubscriptionTierInput(interval, {
                            price: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
  const {
    dishes,
    setDishes,
    availableDishes,
    hasActiveOrders,
    addDish,
    removeDish,
    persistDishOrder,
  } = useListingDetail();
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

  async function handleRemove(dish: ListingDish) {
    if (hasActiveOrders) {
      setRemoveBlocked(true);
      return;
    }
    const ok = await removeDish(dish);
    if (!ok) setRemoveBlocked(true);
  }

  async function handleAddDish(available: AvailableDish) {
    const ok = await addDish(available);
    if (ok) setShowPicker(false);
  }

  const pickerOptions = availableDishes;

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
            onDragEnd={() => {
              setDragId(null);
              void persistDishOrder(dishes);
            }}
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

const DEAL_TYPE_LABELS: [UiDealType, string][] = [
  ["percentage_off", "% Off"],
  ["fixed_off", "$ Off"],
];

function DealsTab() {
  const { deals, createDeal, deleteDeal } = useListingDetail();
  const [showForm, setShowForm] = useState(false);
  const [newDeal, setNewDeal] = useState({
    type: "percentage_off" as UiDealType,
    value: "",
    validFrom: "",
    validUntil: "",
    maxUses: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  async function handleDeleteDeal(id: string) {
    await deleteDeal(id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeal.validUntil && !newDeal.maxUses) {
      setFormError(
        "Set either an expiry date or a max redemption limit — a deal can't be unlimited.",
      );
      return;
    }
    setFormError(null);
    const err = await createDeal(newDeal);
    if (err) {
      setFormError(err);
      return;
    }
    setShowForm(false);
    setNewDeal({
      type: "percentage_off",
      value: "",
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

          <div className={styles.formGroup}>
            <label htmlFor="f-deal-value" className={styles.formLabel}>
              {newDeal.type === "percentage_off" ? "Discount %" : "Discount $"}
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
                    onClick={() => void handleDeleteDeal(deal.id)}
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
  const { orders, loading } = useListingDetail();

  if (loading) {
    return <p className={styles.emptyNote}>Loading orders…</p>;
  }

  return (
    <div className={styles.ordersTab}>
      {orders.map((order) => (
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

// ─── Reviews tab ──────────────────────────────────────────────────────────────

function StarRating({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <div className={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= rating ? styles.starFilled : styles.starEmpty}
        />
      ))}
    </div>
  );
}

function ReviewsTab() {
  const { reviews, loading } = useListingDetail();
  const total = reviews.length;
  const avg = total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;

  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  if (loading) {
    return <p className={styles.emptyNote}>Loading reviews…</p>;
  }

  return (
    <div className={styles.reviewsTab}>
      <div className={styles.reviewSummary}>
        <div className={styles.reviewAvgBlock}>
          <span className={styles.reviewAvgNum}>{avg.toFixed(1)}</span>
          <StarRating rating={Math.round(avg)} size={16} />
          <span className={styles.reviewAvgCount}>{total} reviews</span>
        </div>
        <div className={styles.reviewDist}>
          {dist.map(({ star, count }) => (
            <div key={star} className={styles.reviewDistRow}>
              <span className={styles.reviewDistLabel}>{star}</span>
              <Star size={11} className={styles.starFilled} />
              <div className={styles.reviewDistTrack}>
                <div
                  className={styles.reviewDistFill}
                  style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                />
              </div>
              <span className={styles.reviewDistCount}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.reviewList}>
        {reviews.map((review) => (
          <div key={review.id} className={styles.reviewCard}>
            <div className={styles.reviewCardHead}>
              <div className={styles.reviewCardLeft}>
                <span className={styles.reviewCustomer}>
                  {review.customerName}
                </span>
                <span className={styles.reviewDate}>
                  {new Date(review.date).toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <StarRating rating={review.rating} />
            </div>
            <p className={styles.reviewComment}>{review.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "dishes", label: "Dishes" },
  { id: "deals", label: "Deals" },
  { id: "orders", label: "Orders" },
  { id: "reviews", label: "Reviews" },
];

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const listingId = params.id;

  if (!listingId) {
    return <p className={styles.emptyNote}>Listing not found.</p>;
  }

  return (
    <ListingDetailProvider listingId={listingId}>
      <ListingDetailContent />
    </ListingDetailProvider>
  );
}

function ListingDetailContent() {
  const { loading, error } = useListingDetail();
  const [tab, setTab] = useState<Tab>("overview");

  if (loading) {
    return (
      <div className={styles.page}>
        <BackToListings />
        <p className={styles.emptyNote}>Loading listing…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <BackToListings />
        <p className={styles.emptyNote}>{error}</p>
      </div>
    );
  }

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
        {tab === "reviews" && <ReviewsTab />}
      </div>
    </div>
  );
}
