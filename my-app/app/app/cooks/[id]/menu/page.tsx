"use client";

import { Minus, Plus, Star } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildCartItem, useCart } from "../../../_cart-context";
import styles from "./page.module.css";

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
    delivery: "none" | "self" | null;
    cancellationAllowed: boolean;
    pickupCity: string | null;
    pickupWindows: { dayOfWeek: string; fromTime: string; toTime: string }[];
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
        item,
      });
      return;
    }
    cart.addItem({
      cookId,
      cookName: data.cook.displayName ?? "Cook",
      minOrderQty: data.cook.minOrderQty,
      maxOrderQty: data.cook.maxOrderQty,
      item,
    });
  }

  if (loading) {
    return <div className={styles.state}>Loading menu…</div>;
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
                {cook.cancellationAllowed
                  ? "Free cancellation before the lead time"
                  : "No cancellations"}
              </p>
            </div>

            <fieldset className={styles.fulfillment}>
              <legend className={styles.summaryLabel}>Fulfillment</legend>
              <label className={styles.radioRow}>
                <input
                  type="radio"
                  name="fulfillment"
                  checked={cart.fulfillmentMode === "pickup"}
                  onChange={() => cart.setFulfillment("pickup")}
                />
                Pickup
              </label>
              {cook.delivery === "self" && (
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
              Pickup time
            </label>
            <input
              id="pickup-at"
              type="datetime-local"
              className={styles.input}
              value={cart.pickupAt ?? ""}
              onChange={(e) =>
                cart.setPickupAt(
                  e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                )
              }
            />

            {!meetsMin && totalQty > 0 && (
              <p className={styles.minNotice}>
                Add {cook.minOrderQty - totalQty} more to meet the minimum.
              </p>
            )}

            <button
              type="button"
              className={styles.checkoutBtn}
              disabled={!meetsMin || !cart.pickupAt}
              onClick={() => router.push("/app/checkout")}
            >
              {!cart.pickupAt
                ? "Choose a pickup time"
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
