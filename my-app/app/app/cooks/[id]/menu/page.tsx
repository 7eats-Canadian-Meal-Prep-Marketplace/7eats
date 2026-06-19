"use client";

import { Minus, Plus, Star } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LEAD_TIME_DAYS_MAP, refundPolicyText } from "@/lib/refund-policy";
import { buildCartItem, useCart } from "../../../_cart-context";
import { Skeleton } from "../../../_skeleton";
import styles from "./page.module.css";

// Pickup-slot generation ------------------------------------------------------
// getDay() is 0=Sunday..6=Saturday; windows store lowercase day names.
const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
const SLOT_INTERVAL_MIN = 30;
const PICKUP_DAYS_AHEAD = 14;

type PickupWindow = { dayOfWeek: string; fromTime: string; toTime: string };

/**
 * Expand a cook's weekly pickup windows into concrete, selectable slots over the
 * next two weeks. Lead time is counted in whole calendar days: a 3-day-lead cook
 * ordered from on Monday is pickable from Thursday, so this-week days that fall
 * inside the lead window are skipped and roll to the following week.
 */
function generatePickupSlots(
  windows: PickupWindow[],
  leadTime: string | null,
  now: Date,
): { iso: string; label: string }[] {
  if (windows.length === 0) return [];
  const leadDays = leadTime ? (LEAD_TIME_DAYS_MAP[leadTime] ?? 0) : 0;
  const byDay = new Map(windows.map((w) => [w.dayOfWeek, w]));

  const slots: { iso: string; label: string }[] = [];
  for (let d = 0; d < PICKUP_DAYS_AHEAD; d++) {
    // Need at least `leadDays` calendar days of notice for this pickup day.
    if (d < leadDays) continue;
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const win = byDay.get(DAY_NAMES[day.getDay()]);
    if (!win) continue;
    const [fh, fm] = win.fromTime.split(":").map(Number);
    const [th, tm] = win.toTime.split(":").map(Number);
    const start = new Date(day);
    start.setHours(fh, fm, 0, 0);
    const end = new Date(day);
    end.setHours(th, tm, 0, 0);
    for (
      let t = start;
      t < end;
      t = new Date(t.getTime() + SLOT_INTERVAL_MIN * 60_000)
    ) {
      // Never offer a time already in the past (matters only for same-day).
      if (t <= now) continue;
      slots.push({
        iso: t.toISOString(),
        label: t.toLocaleString("en-CA", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    }
  }
  return slots;
}

type Promotion = {
  id: string;
  type: "percentage_off" | "fixed_off";
  value: string;
  validUntil: string | null;
  maxUses: number | null;
  usesCount: number;
};

type Dish = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  photos: { url: string; sortOrder: number }[];
  tags: { slug: string; label: string }[];
  promotion: Promotion | null;
};

type MenuData = {
  cook: {
    id: string;
    displayName: string | null;
    photoUrl: string | null;
    bio: string | null;
    minOrderQty: number;
    maxOrderQty: number | null;
    leadTime: string | null;
    offersPickup: boolean;
    delivery: "none" | "self" | null;
    cancellationAllowed: boolean;
    pickupCity: string | null;
    pickupWindows: { dayOfWeek: string; fromTime: string; toTime: string }[];
    deliveryWindows: { dayOfWeek: string; fromTime: string; toTime: string }[];
  };
  dishes: Dish[];
};

function promoLabel(promo: Promotion): string {
  return promo.type === "percentage_off"
    ? `${Number(promo.value)}% off`
    : `$${Number(promo.value)} off`;
}

export default function CookMenuPage() {
  const params = useParams<{ id: string }>();
  const cookId = params.id;
  const router = useRouter();
  const cart = useCart();

  const [data, setData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cooks/${cookId}/menu`)
      .then((r) => {
        if (r.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((json) => {
        if (cancelled || !json) return;
        setData(json.data ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cookId]);

  // Map current cart quantities by dishId (only when this cook's cart is active).
  const qtyByDish = useMemo(() => {
    const map: Record<string, number> = {};
    if (cart.cookId === cookId) {
      for (const i of cart.items) map[i.dishId] = i.quantity;
    }
    return map;
  }, [cart.cookId, cart.items, cookId]);

  // Concrete slots from the cook's weekly windows (lead time applied).
  const fulfillmentSlots = useMemo(() => {
    if (!data) return [];
    const windows =
      cart.fulfillmentMode === "delivery"
        ? data.cook.deliveryWindows
        : data.cook.pickupWindows;
    return generatePickupSlots(windows, data.cook.leadTime, new Date());
  }, [data, cart.fulfillmentMode]);

  const canPickup = data?.cook.offersPickup !== false;
  const canDeliver = data?.cook.delivery === "self";

  useEffect(() => {
    if (!data) return;
    if (canPickup && !canDeliver && cart.fulfillmentMode !== "pickup") {
      cart.setFulfillment("pickup");
    } else if (
      !canPickup &&
      canDeliver &&
      cart.fulfillmentMode !== "delivery"
    ) {
      cart.setFulfillment("delivery");
    }
  }, [data, canPickup, canDeliver, cart.fulfillmentMode, cart.setFulfillment]);

  useEffect(() => {
    if (
      cart.pickupAt &&
      !fulfillmentSlots.some((s) => s.iso === cart.pickupAt)
    ) {
      cart.setPickupAt(null);
    }
  }, [cart.pickupAt, cart.setPickupAt, fulfillmentSlots]);

  function changeQty(dish: Dish, nextQty: number) {
    const promo = dish.promotion
      ? {
          id: dish.promotion.id,
          type: dish.promotion.type,
          value: Number(dish.promotion.value),
        }
      : null;
    const item = buildCartItem(
      { id: dish.id, name: dish.name, price: Number(dish.price) },
      Math.max(0, nextQty),
      promo,
    );
    if (!data) return;

    if (cart.cookId && cart.cookId !== cookId && cart.items.length > 0) {
      const ok = window.confirm(
        `Your cart has items from ${cart.cookName}. Start a new order from ${data.cook.displayName}?`,
      );
      if (!ok) return;
      cart.clearAndAdd({
        cookId,
        cookName: data.cook.displayName ?? "Cook",
        minOrderQty: data.cook.minOrderQty,
        maxOrderQty: data.cook.maxOrderQty,
        leadTime: data.cook.leadTime,
        cancellationAllowed: data.cook.cancellationAllowed,
        item,
      });
      return;
    }
    cart.addItem({
      cookId,
      cookName: data.cook.displayName ?? "Cook",
      minOrderQty: data.cook.minOrderQty,
      maxOrderQty: data.cook.maxOrderQty,
      leadTime: data.cook.leadTime,
      cancellationAllowed: data.cook.cancellationAllowed,
      item,
    });
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.layout}>
          <main className={styles.menuCol}>
            <header className={styles.cookHeader}>
              <Skeleton circle width={56} height={56} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  flex: 1,
                }}
              >
                <Skeleton width="50%" height={20} radius={6} />
                <Skeleton width="30%" height={13} radius={6} />
              </div>
            </header>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: 12, alignItems: "center" }}
                >
                  <Skeleton width={72} height={72} radius={12} />
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <Skeleton width="60%" height={16} radius={6} />
                    <Skeleton width="85%" height={12} radius={6} />
                    <Skeleton width={56} height={14} radius={6} />
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }
  if (notFound || !data) {
    return (
      <div className={styles.state}>
        <p>This kitchen isn’t available right now.</p>
        <Link href="/app/browse" className={styles.backLink}>
          Browse other cooks
        </Link>
      </div>
    );
  }

  const { cook, dishes } = data;
  const activeForThisCook = cart.cookId === cookId;
  const total = activeForThisCook ? cart.subtotal : 0;
  const totalQty = activeForThisCook ? cart.totalQuantity : 0;
  const meetsMin = totalQty >= cook.minOrderQty;

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        {/* Left: dishes */}
        <main className={styles.menuCol}>
          <header className={styles.cookHeader}>
            <div className={styles.cookAvatar}>
              {cook.photoUrl ? (
                // biome-ignore lint/performance/noImgElement: avatar
                <img
                  src={cook.photoUrl}
                  alt=""
                  className={styles.cookAvatarImg}
                />
              ) : (
                <span>{(cook.displayName ?? "C").charAt(0)}</span>
              )}
            </div>
            <div>
              <h1 className={styles.cookName}>{cook.displayName}</h1>
              {cook.pickupCity && (
                <p className={styles.cookMeta}>{cook.pickupCity}</p>
              )}
              <Link
                href={`/app/cooks/${cookId}`}
                className={styles.profileLink}
              >
                View profile
              </Link>
            </div>
          </header>

          {dishes.length === 0 ? (
            <p className={styles.state}>No dishes available yet.</p>
          ) : (
            <ul className={styles.dishList}>
              {dishes.map((dish) => {
                const qty = qtyByDish[dish.id] ?? 0;
                return (
                  <li key={dish.id} className={styles.dishCard}>
                    <div className={styles.dishPhoto}>
                      {dish.photos[0] ? (
                        // biome-ignore lint/performance/noImgElement: dish photo
                        <img
                          src={dish.photos[0].url}
                          alt={dish.name}
                          className={styles.dishPhotoImg}
                        />
                      ) : (
                        <div className={styles.dishPhotoPlaceholder} />
                      )}
                      {dish.promotion && (
                        <span className={styles.promoBadge}>
                          {promoLabel(dish.promotion)}
                        </span>
                      )}
                    </div>
                    <div className={styles.dishBody}>
                      <h3 className={styles.dishName}>{dish.name}</h3>
                      {dish.description && (
                        <p className={styles.dishDesc}>{dish.description}</p>
                      )}
                      <div className={styles.dishTags}>
                        {dish.tags.map((t) => (
                          <span key={t.slug} className={styles.tag}>
                            {t.label}
                          </span>
                        ))}
                      </div>
                      <div className={styles.dishFooter}>
                        <span className={styles.dishPrice}>
                          ${Number(dish.price).toFixed(2)}
                        </span>
                        <div className={styles.stepper}>
                          <button
                            type="button"
                            className={styles.stepBtn}
                            onClick={() => changeQty(dish, qty - 1)}
                            disabled={qty === 0}
                            aria-label={`Remove one ${dish.name}`}
                          >
                            <Minus size={16} />
                          </button>
                          <span className={styles.stepQty}>{qty}</span>
                          <button
                            type="button"
                            className={styles.stepBtn}
                            onClick={() => changeQty(dish, qty + 1)}
                            aria-label={`Add one ${dish.name}`}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </main>

        {/* Right: order summary */}
        <aside className={styles.summaryCol}>
          <div className={styles.summary}>
            <h2 className={styles.summaryTitle}>Your order</h2>
            {totalQty === 0 ? (
              <p className={styles.summaryEmpty}>
                Add dishes to start your order.
              </p>
            ) : (
              <>
                <ul className={styles.summaryItems}>
                  {cart.items.map((i) => (
                    <li key={i.dishId} className={styles.summaryItem}>
                      <span>
                        {i.quantity}× {i.name}
                      </span>
                      <span>${i.lineTotal.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className={styles.summaryTotal}>
                  <span>Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </>
            )}

            <div className={styles.policy}>
              <p>
                <Star size={12} /> Min order: {cook.minOrderQty} item
                {cook.minOrderQty === 1 ? "" : "s"}
                {cook.maxOrderQty ? ` · Max: ${cook.maxOrderQty}` : ""}
              </p>
              <p>
                {refundPolicyText(
                  cook.cancellationAllowed,
                  cart.pickupAt,
                  cook.leadTime,
                )}
              </p>
            </div>

            <fieldset className={styles.fulfillment}>
              <legend className={styles.summaryLabel}>Fulfillment</legend>
              {canPickup && (
                <label className={styles.radioRow}>
                  <input
                    type="radio"
                    name="fulfillment"
                    checked={cart.fulfillmentMode === "pickup"}
                    onChange={() => cart.setFulfillment("pickup")}
                  />
                  Pickup
                </label>
              )}
              {canDeliver && (
                <label className={styles.radioRow}>
                  <input
                    type="radio"
                    name="fulfillment"
                    checked={cart.fulfillmentMode === "delivery"}
                    onChange={() => cart.setFulfillment("delivery")}
                  />
                  Delivery
                </label>
              )}
            </fieldset>

            <label className={styles.summaryLabel} htmlFor="pickup-at">
              {cart.fulfillmentMode === "delivery"
                ? "Delivery time"
                : "Pickup time"}
            </label>
            {fulfillmentSlots.length === 0 ? (
              <p className={styles.minNotice}>
                {cart.fulfillmentMode === "delivery"
                  ? "This cook has no delivery times available right now."
                  : "This cook has no pickup times available right now."}
              </p>
            ) : (
              <select
                id="pickup-at"
                className={styles.input}
                value={
                  cart.pickupAt &&
                  fulfillmentSlots.some((s) => s.iso === cart.pickupAt)
                    ? cart.pickupAt
                    : ""
                }
                onChange={(e) =>
                  cart.setPickupAt(e.target.value ? e.target.value : null)
                }
              >
                <option value="">
                  {cart.fulfillmentMode === "delivery"
                    ? "Choose a delivery time…"
                    : "Choose a pickup time…"}
                </option>
                {fulfillmentSlots.map((slot) => (
                  <option key={slot.iso} value={slot.iso}>
                    {slot.label}
                  </option>
                ))}
              </select>
            )}

            {!meetsMin && totalQty > 0 && (
              <p className={styles.minNotice}>
                Add {cook.minOrderQty - totalQty} more to meet the minimum.
              </p>
            )}

            <button
              type="button"
              className={styles.checkoutBtn}
              disabled={
                !meetsMin ||
                !cart.pickupAt ||
                fulfillmentSlots.length === 0 ||
                !fulfillmentSlots.some((s) => s.iso === cart.pickupAt)
              }
              onClick={() => router.push("/app/checkout")}
            >
              {fulfillmentSlots.length === 0
                ? cart.fulfillmentMode === "delivery"
                  ? "No delivery times available"
                  : "No pickup times available"
                : !cart.pickupAt
                  ? cart.fulfillmentMode === "delivery"
                    ? "Choose a delivery time"
                    : "Choose a pickup time"
                  : !meetsMin
                    ? `Minimum ${cook.minOrderQty} items`
                    : "Go to checkout"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
