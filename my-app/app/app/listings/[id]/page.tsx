"use client";

import {
  ArrowLeft,
  Check,
  CheckCircle,
  Clock,
  Info,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  Star,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  INTERVAL_LABELS,
  INTERVAL_SHORT_LABELS,
  type SubscriptionInterval,
} from "@/lib/subscription-schedule";
import { useCart } from "../../_cart-context";
import { getChargeShort } from "../../_subscription-utils";
import { DealCallout } from "./_DealCallout";
import type { Dish } from "./_DishModal";
import DishModal from "./_DishModal";
import styles from "./page.module.css";

// ── Local API types ──────────────────────────────────────────────────────────

type ApiDish = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  portionSize: string | null;
};

type ApiPromotion = {
  id: string;
  type: string;
  value: number | null;
  badge: string;
};

type ApiBundle = {
  id: string;
  quantity: number;
  price: number;
  label: string | null;
};

type ApiTier = {
  id: string;
  interval: SubscriptionInterval;
  price: number;
};

type ApiCook = {
  id: string;
  name: string;
  firstName: string | null;
  neighborhood: string | null;
  rating: number | null;
  isVerified: boolean;
};

type ApiListing = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  subscriptionEnabled: boolean;
  basePrice: number;
  currency: string;
  minOrderQty: number;
  maxOrderQty: number | null;
  coverPhotoUrl: string | null;
  depositEnabled: boolean;
  createdAt: string;
  cook: ApiCook;
  dishes: ApiDish[];
  promotion: ApiPromotion | null;
  bundles: ApiBundle[];
  tiers: ApiTier[];
};

type ApiReview = {
  id: string;
  rating: number;
  comment: string | null;
  reviewerName: string;
  createdAt: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert an ApiDish to the Dish shape that DishModal expects */
function toDish(d: ApiDish): Dish {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? "",
    price: d.price,
    portionSize: d.portionSize ?? "",
    emoji: "🍽️",
    badges: [],
  };
}

/** Format ISO date as "May 28" */
function formatReviewDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

/** Derive initials from a full name */
function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Join items into a human-readable list: "a", "a or b", "a, b, or c" */
function joinWithOr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { setListingItems, items } = useCart();
  const router = useRouter();

  // ── API state ──────────────────────────────────────────────────────────────
  const [listing, setListing] = useState<ApiListing | null>(null);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  useEffect(() => {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

    let cancelled = false;

    async function fetchData() {
      try {
        const [listingRes, reviewsRes] = await Promise.all([
          fetch(`${baseUrl}/api/listings/${id}`, { cache: "no-store" }),
          fetch(`${baseUrl}/api/listings/${id}/reviews`, { cache: "no-store" }),
        ]);

        if (!listingRes.ok) {
          if (!cancelled) setNotFoundFlag(true);
          return;
        }

        const listingJson = await listingRes.json();
        const reviewsJson = reviewsRes.ok
          ? await reviewsRes.json()
          : { data: [] };

        if (!cancelled) {
          setListing(listingJson.data);
          setReviews(reviewsJson.data ?? []);
        }
      } catch {
        if (!cancelled) setNotFoundFlag(true);
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ── Subscribe mode ─────────────────────────────────────────────────────────
  // `selectedTierId === null` means "order once"; otherwise the chosen
  // subscription tier's id.
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [localFulfillment, setLocalFulfillment] = useState<
    "pickup" | "delivery"
  >("pickup");
  const wasInCartRef = useRef(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [isModifying, setIsModifying] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: id is an intentional trigger dep
  useEffect(() => {
    wasInCartRef.current = false;
    setQuantities({});
    setSelectedDish(null);
    setIsModifying(false);
    setSelectedTierId(null);
  }, [id]);

  const isInCart = useMemo(
    () => (listing ? items.some((i) => i.listingId === listing.id) : false),
    [items, listing],
  );
  const orderLocked = isInCart && !isModifying;

  const getQty = (dishId: string) => quantities[dishId] ?? 0;

  // Sync read-only view when this listing is already in the cart
  useEffect(() => {
    if (!listing) return;
    const fromCart = items.filter((i) => i.listingId === listing.id);
    if (fromCart.length > 0) {
      const next: Record<string, number> = {};
      for (const line of fromCart) next[line.dishId] = line.quantity;
      setQuantities(next);
      setSelectedTierId(fromCart[0].tierId ?? null);
      wasInCartRef.current = true;
      return;
    }
    if (wasInCartRef.current) {
      setQuantities({});
      setSelectedTierId(null);
      setLocalFulfillment("pickup");
      wasInCartRef.current = false;
      setIsModifying(false);
    }
  }, [listing, items]);

  const restoreFromCart = useCallback(() => {
    if (!listing) return;
    const fromCart = items.filter((i) => i.listingId === listing.id);
    const next: Record<string, number> = {};
    for (const line of fromCart) next[line.dishId] = line.quantity;
    if (fromCart.length > 0) {
      setSelectedTierId(fromCart[0].tierId ?? null);
    }
    setQuantities(next);
  }, [listing, items]);

  const selectedTier = useMemo(
    () => listing?.tiers.find((t) => t.id === selectedTierId) ?? null,
    [listing, selectedTierId],
  );

  const unitPrice = useCallback(
    (dish: ApiDish) => selectedTier?.price ?? dish.price,
    [selectedTier],
  );

  const selectionCount = useMemo(
    () => Object.values(quantities).reduce((sum, q) => sum + q, 0),
    [quantities],
  );

  const handleAdd = (dish: Dish) => {
    if (orderLocked || !listing) return;
    setQuantities((prev) => {
      const current = Object.values(prev).reduce((s, q) => s + q, 0);
      if (
        listing.maxOrderQty !== null &&
        listing.maxOrderQty !== undefined &&
        current >= listing.maxOrderQty
      )
        return prev;
      const newQty = (prev[dish.id] ?? 0) + 1;
      return { ...prev, [dish.id]: newQty };
    });
  };

  const handleDecrement = (dish: Dish) => {
    if (orderLocked) return;
    setQuantities((prev) => {
      const newQty = Math.max(0, (prev[dish.id] ?? 0) - 1);
      if (newQty === 0) {
        const { [dish.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dish.id]: newQty };
    });
  };

  const selectionTotal = useMemo(() => {
    if (!listing) return 0;
    return listing.dishes.reduce(
      (sum, dish) => sum + unitPrice(dish) * (quantities[dish.id] ?? 0),
      0,
    );
  }, [listing, quantities, unitPrice]);

  const hasSelection = selectionCount > 0;
  const meetsMinUnits =
    !listing?.minOrderQty || selectionCount >= listing.minOrderQty;
  const atMaxUnits =
    listing?.maxOrderQty !== null &&
    listing?.maxOrderQty !== undefined &&
    selectionCount >= (listing?.maxOrderQty ?? 0);
  const canAddToCart = hasSelection && meetsMinUnits;
  const unitsNeeded = listing?.minOrderQty
    ? Math.max(0, listing.minOrderQty - selectionCount)
    : 0;

  const buildCartLines = () => {
    if (!listing) return [];
    const cookId = listing.cook.id;
    const cookName = listing.cook.name;
    const cookInitials = nameInitials(cookName);
    return listing.dishes
      .filter((dish) => getQty(dish.id) > 0)
      .map((dish) => ({
        dishId: dish.id,
        dishName: dish.name,
        dishEmoji: "🍽️",
        listingId: listing.id,
        listingTitle: listing.title,
        orderType: (selectedTier ? "subscription" : "one_time") as
          | "one_time"
          | "subscription",
        tierId: selectedTier?.id,
        subscriptionInterval: selectedTier?.interval,
        fulfillmentMode: localFulfillment,
        cookId,
        cookName,
        cookInitials,
        cookGradient: "linear-gradient(135deg, #6b6b6b 0%, #3a3a3a 100%)",
        price: unitPrice(dish),
        quantity: getQty(dish.id),
      }));
  };

  const handleAddToCart = () => {
    if (!canAddToCart || !listing) return;
    if (isInCart && !isModifying) return;
    setListingItems(listing.id, buildCartLines());
    setIsModifying(false);
    router.push("/app/cart");
  };

  const startModifying = () => {
    restoreFromCart();
    setIsModifying(true);
  };

  const cancelModifying = () => {
    restoreFromCart();
    setIsModifying(false);
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (notFoundFlag) {
    notFound();
  }

  if (!listing) {
    return (
      <div className={styles.page}>
        <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
          Loading…
        </div>
      </div>
    );
  }

  // Derived display values
  const cook = listing.cook;
  const cookName = cook.name;
  const cookInitials = nameInitials(cookName);
  const cookGradient = "linear-gradient(135deg, #6b6b6b 0%, #3a3a3a 100%)";

  // Promotion → deal shape for DealCallout
  const deal = listing.promotion ? { badge: listing.promotion.badge } : null;

  // Bundles → priceTiers shape
  const priceTiers = listing.bundles.map((b) => ({
    minUnits: b.quantity,
    savingsLabel: b.label ?? `Bundle of ${b.quantity} – $${b.price}`,
  }));

  const hasPolicy =
    deal || priceTiers.length > 0 || listing.minOrderQty || listing.maxOrderQty;

  const totalReviewCount = reviews.length;

  // Cook bar reused in mobile strip and sidebar
  const cookBarContent = (
    <Link href={`/app/cooks/${cook.id}`} className={styles.cookBar}>
      <div className={styles.cookAvatar} style={{ background: cookGradient }}>
        {cookInitials}
      </div>
      <div className={styles.cookInfo}>
        <span className={styles.cookName}>{cookName}</span>
        <span className={styles.cookMeta}>
          {cook.neighborhood ? `${cook.neighborhood}, Toronto` : "Toronto"}
        </span>
      </div>
      {cook.isVerified && (
        <CheckCircle size={16} className={styles.verifiedIcon} />
      )}
      {cook.rating !== null && (
        <div className={styles.cookRating}>
          <Star size={13} fill="currentColor" className={styles.ratingStar} />
          <span className={styles.ratingNum}>{cook.rating}</span>
          <span className={styles.ratingCount}>({totalReviewCount})</span>
        </div>
      )}
    </Link>
  );

  return (
    <div className={styles.page}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        {/* biome-ignore lint/performance/noImgElement: listing hero */}
        <img
          src={listing.coverPhotoUrl ?? "/placeholder.jpg"}
          alt={listing.title}
          className={styles.heroImg}
        />
        <div className={styles.heroOverlay} />
        <button
          type="button"
          className={styles.backBtn}
          aria-label="Back"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.replace("/app/browse");
          }}
        >
          <ArrowLeft size={20} />
        </button>
        {deal && <div className={styles.heroDeal}>{deal.badge}</div>}
      </div>

      {/* ── Two-column ───────────────────────────────────────────────────── */}
      <div className={styles.content}>
        {/* ── LEFT: food-first ─────────────────────────────────────────── */}
        <div className={styles.main}>
          <h1 className={styles.title}>{listing.title}</h1>
          {reviews.length > 0 && cook.rating !== null && (
            <div className={styles.titleMeta}>
              <Star
                size={13}
                fill="currentColor"
                className={styles.titleStar}
              />
              <span className={styles.titleRating}>{cook.rating}</span>
              <span className={styles.titleDot}>·</span>
              <a href="#reviews" className={styles.reviewsLink}>
                {totalReviewCount} review{totalReviewCount !== 1 ? "s" : ""}
              </a>
            </div>
          )}
          <p className={styles.desc}>{listing.description}</p>

          {/* Subscription availability banner */}
          {listing.subscriptionEnabled && listing.tiers.length > 0 && (
            <div className={styles.subscriptionInfo}>
              <RefreshCw size={14} className={styles.subscriptionIcon} />
              <div>
                <span className={styles.subscriptionTitle}>
                  Subscriptions available
                </span>
                <span className={styles.subscriptionDetail}>
                  Subscribe{" "}
                  {joinWithOr(
                    listing.tiers.map((t) =>
                      INTERVAL_LABELS[t.interval].toLowerCase(),
                    ),
                  )}{" "}
                  and get this automatically. Cancel any time.
                </span>
              </div>
            </div>
          )}

          {/* Mobile-only: cook + pickup + policy (sidebar handles these on desktop) */}
          <div className={styles.mobileInfo}>
            <hr className={styles.rule} />
            {cookBarContent}
            <hr className={styles.mobileRule} />
            <div className={styles.pickupStrip}>
              <div className={styles.pickupItem}>
                <Clock size={16} className={styles.pickupIcon} />
                <div>
                  <div className={styles.pickupLabel}>Order min</div>
                  <div className={styles.pickupVal}>
                    {listing.minOrderQty} portion
                    {listing.minOrderQty !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <div className={styles.pickupItem}>
                <ShoppingBag size={16} className={styles.pickupIcon} />
                <div>
                  <div className={styles.pickupLabel}>Base price</div>
                  <div className={styles.pickupVal}>
                    ${listing.basePrice} / portion
                  </div>
                </div>
              </div>
              <div className={styles.pickupItem}>
                <MapPin size={16} className={styles.pickupIcon} />
                <div>
                  <div className={styles.pickupLabel}>Location</div>
                  <div className={styles.pickupVal}>
                    {cook.neighborhood ?? "Toronto"}
                  </div>
                </div>
              </div>
            </div>
            {hasPolicy && (
              <>
                <hr className={styles.rule} />
                <div className={styles.policySection}>
                  {deal && (
                    <div className={styles.dealCallout}>
                      <p className={styles.dealCalloutBadge}>{deal.badge}</p>
                    </div>
                  )}
                  {priceTiers.length > 0 && (
                    <div className={styles.policyRow}>
                      <TrendingDown size={15} className={styles.policyIcon} />
                      <div className={styles.policyBody}>
                        <span className={styles.policyTitle}>Bundle deals</span>
                        <span className={styles.policyDesc}>
                          {priceTiers
                            .map((t) => `${t.minUnits}+: ${t.savingsLabel}`)
                            .join("  ·  ")}
                        </span>
                      </div>
                    </div>
                  )}
                  {(listing.minOrderQty || listing.maxOrderQty) && (
                    <div className={styles.policyRow}>
                      <Info size={15} className={styles.policyIcon} />
                      <div className={styles.policyBody}>
                        <span className={styles.policyTitle}>
                          {listing.minOrderQty && listing.maxOrderQty
                            ? `${listing.minOrderQty}–${listing.maxOrderQty} portions per order`
                            : listing.minOrderQty
                              ? `Minimum ${listing.minOrderQty} portions`
                              : `Maximum ${listing.maxOrderQty} portions`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <hr className={styles.rule} />

          {/* ── Menu ──────────────────────────────────────────────────────── */}
          <h2 className={styles.sectionTitle}>What&apos;s on the menu</h2>
          <div className={styles.dishes}>
            {listing.dishes.map((dish) => {
              const mockDish = toDish(dish);
              const qty = getQty(dish.id);
              const atListingMax =
                !orderLocked &&
                listing.maxOrderQty !== null &&
                listing.maxOrderQty !== undefined &&
                selectionCount >= listing.maxOrderQty &&
                qty === 0;
              const controlsLocked = orderLocked || atMaxUnits;
              return (
                /* biome-ignore lint/a11y/useSemanticElements: contains nested buttons */
                <div
                  key={dish.id}
                  className={styles.dishCard}
                  onClick={() => setSelectedDish(mockDish)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      setSelectedDish(mockDish);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${dish.name} details`}
                >
                  <div className={styles.dishCover}>
                    {/* biome-ignore lint/performance/noImgElement: placeholder */}
                    <img
                      src="/placeholder.jpg"
                      alt={dish.name}
                      className={styles.dishCoverImg}
                      width={88}
                      height={88}
                      loading="lazy"
                    />
                  </div>
                  <div className={styles.dishBody}>
                    <div className={styles.dishRow}>
                      <div className={styles.dishLeft}>
                        <h3 className={styles.dishName}>{dish.name}</h3>
                        <p className={styles.dishDesc}>
                          {dish.description ?? ""}
                        </p>
                        {dish.portionSize && (
                          <div className={styles.dishTags}>
                            <span className={styles.portion}>
                              {dish.portionSize}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops modal open */}
                      <div
                        className={styles.dishRight}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <span className={styles.dishPrice}>${dish.price}</span>
                        {qty === 0 ? (
                          <button
                            type="button"
                            className={`${styles.addBtn} ${atListingMax || orderLocked ? styles.addBtnDisabled : ""}`}
                            onClick={() => handleAdd(mockDish)}
                            disabled={!!atListingMax || orderLocked}
                            aria-label={`Add ${dish.name}`}
                          >
                            <Plus size={16} strokeWidth={2.5} />
                          </button>
                        ) : (
                          <div className={styles.qtyControl}>
                            <button
                              type="button"
                              className={`${styles.qtyBtn} ${orderLocked ? styles.qtyBtnDisabled : ""}`}
                              onClick={() => handleDecrement(mockDish)}
                              disabled={orderLocked}
                            >
                              <Minus size={14} />
                            </button>
                            <span className={styles.qtyNum}>{qty}</span>
                            <button
                              type="button"
                              className={`${styles.qtyBtn} ${controlsLocked ? styles.qtyBtnDisabled : ""}`}
                              onClick={() => handleAdd(mockDish)}
                              disabled={controlsLocked}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Reviews ──────────────────────────────────────────────────── */}
          {reviews.length > 0 && (
            <>
              <hr className={styles.rule} />
              <section id="reviews" className={styles.reviewsSection}>
                <h2 className={styles.sectionTitle}>
                  <Star
                    size={18}
                    fill="currentColor"
                    className={styles.ratingStar}
                  />
                  {cook.rating ?? "–"} · {totalReviewCount} review
                  {totalReviewCount !== 1 ? "s" : ""}
                </h2>
                <div className={styles.reviewList}>
                  {reviews.map((review) => {
                    const initials = nameInitials(review.reviewerName);
                    return (
                      <div key={review.id} className={styles.reviewCard}>
                        <div className={styles.reviewTop}>
                          <div className={styles.reviewerAvatar}>
                            {initials}
                          </div>
                          <div className={styles.reviewerInfo}>
                            <span className={styles.reviewerName}>
                              {review.reviewerName}
                            </span>
                            <span className={styles.reviewDate}>
                              {formatReviewDate(review.createdAt)}
                            </span>
                          </div>
                          <div className={styles.reviewStars}>
                            {Array.from({ length: 5 }, (_, i) => i).map((i) => (
                              <Star
                                key={`star-${i}`}
                                size={12}
                                fill={
                                  i < review.rating ? "currentColor" : "none"
                                }
                                className={
                                  i < review.rating
                                    ? styles.starFilled
                                    : styles.starEmpty
                                }
                              />
                            ))}
                          </div>
                        </div>
                        <p className={styles.reviewComment}>
                          {review.comment ?? ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {/* ── RIGHT: three stacked cards ───────────────────────────────── */}
        <aside className={styles.sidebar}>
          {/* Card 1 — Order widget */}
          <div className={styles.orderCard}>
            <div className={styles.logisticsGrid}>
              <span className={styles.logLabel}>From</span>
              <span className={styles.logVal}>
                ${listing.basePrice} / portion
              </span>
              {listing.minOrderQty && (
                <>
                  <span className={styles.logLabel}>Min order</span>
                  <span className={styles.logVal}>
                    {listing.minOrderQty} portion
                    {listing.minOrderQty !== 1 ? "s" : ""}
                  </span>
                </>
              )}
              {listing.maxOrderQty && (
                <>
                  <span className={styles.logLabel}>Max order</span>
                  <span className={styles.logVal}>
                    {listing.maxOrderQty} portions
                  </span>
                </>
              )}
            </div>

            {hasSelection && (
              <div className={styles.bookingSummary}>
                <hr className={styles.bookingRule} />
                {listing.dishes
                  .filter((dish) => getQty(dish.id) > 0)
                  .map((dish) => (
                    <div key={dish.id} className={styles.summaryRow}>
                      <span className={styles.summaryName}>
                        {getQty(dish.id)}× {dish.name}
                      </span>
                      <span className={styles.summaryPrice}>
                        ${unitPrice(dish) * getQty(dish.id)}
                      </span>
                    </div>
                  ))}
                <div className={styles.summaryTotal}>
                  <span>Total</span>
                  <span>${selectionTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className={styles.ctaWrap}>
              {listing.subscriptionEnabled &&
                listing.tiers.length > 0 &&
                (!isInCart || isModifying) && (
                  <div className={styles.orderModeToggle}>
                    <button
                      type="button"
                      className={`${styles.orderModeBtn} ${!selectedTier ? styles.orderModeBtnActive : ""}`}
                      onClick={() => setSelectedTierId(null)}
                    >
                      Order once
                    </button>
                    {listing.tiers.map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        className={`${styles.orderModeBtn} ${selectedTierId === tier.id ? styles.orderModeBtnActive : ""}`}
                        onClick={() => setSelectedTierId(tier.id)}
                      >
                        <RefreshCw size={11} />
                        {INTERVAL_LABELS[tier.interval]}
                      </button>
                    ))}
                  </div>
                )}

              {selectedTier && (
                <p className={styles.weeklyNote}>
                  <RefreshCw size={11} />
                  {getChargeShort(selectedTier.interval)}
                </p>
              )}

              {isInCart && !isModifying ? (
                <div className={styles.inCartBanner}>
                  <div className={styles.inCartBannerHead}>
                    <Check size={18} strokeWidth={2.5} aria-hidden />
                    <p className={styles.inCartBannerTitle}>In cart</p>
                  </div>
                  <div className={styles.inCartBannerActions}>
                    <button
                      type="button"
                      className={styles.inCartModifyBtn}
                      onClick={startModifying}
                    >
                      Modify order
                    </button>
                    <Link href="/app/cart" className={styles.inCartViewLink}>
                      View cart
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className={`${styles.ctaBtn} ${canAddToCart ? styles.ctaBtnActive : ""}`}
                    onClick={handleAddToCart}
                    disabled={!canAddToCart}
                  >
                    {!hasSelection
                      ? "Select dishes to order"
                      : !meetsMinUnits
                        ? `Add ${unitsNeeded} more portion${unitsNeeded !== 1 ? "s" : ""}`
                        : isInCart && isModifying
                          ? `Update cart · $${selectionTotal.toFixed(2)}`
                          : selectedTier
                            ? `Subscribe ${INTERVAL_LABELS[selectedTier.interval].toLowerCase()} · $${selectionTotal.toFixed(2)}/${INTERVAL_SHORT_LABELS[selectedTier.interval]}`
                            : `Add to cart · $${selectionTotal.toFixed(2)}`}
                  </button>
                  {isInCart && isModifying && (
                    <button
                      type="button"
                      className={styles.cancelModifyBtn}
                      onClick={cancelModifying}
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Card 2 — Cook */}
          <div className={styles.cookCard}>
            <Link
              href={`/app/cooks/${cook.id}`}
              className={styles.cookCardLink}
            >
              <div
                className={styles.cookCardAvatar}
                style={{ background: cookGradient }}
              >
                {cookInitials}
              </div>
              <div className={styles.cookCardBody}>
                <div className={styles.cookCardTop}>
                  <span className={styles.cookCardName}>{cookName}</span>
                  {cook.isVerified && (
                    <CheckCircle
                      size={14}
                      className={styles.cookCardVerified}
                    />
                  )}
                </div>
                <span className={styles.cookCardMeta}>
                  {cook.neighborhood
                    ? `${cook.neighborhood}, Toronto`
                    : "Toronto"}
                </span>
                {cook.rating !== null && (
                  <div className={styles.cookCardStats}>
                    <Star
                      size={12}
                      fill="currentColor"
                      className={styles.ratingStar}
                    />
                    <span className={styles.cookCardRating}>{cook.rating}</span>
                    <span className={styles.cookCardReviews}>
                      ({totalReviewCount} reviews)
                    </span>
                  </div>
                )}
              </div>
            </Link>
          </div>

          {/* Card 3 — Bundle deals & order policy (only when applicable) */}
          {hasPolicy && (
            <div className={styles.policyCard}>
              {deal && <DealCallout deal={deal} />}
              {priceTiers.length > 0 && (
                <div className={styles.pcSection}>
                  <span className={styles.pcHead}>Bundle deals</span>
                  {priceTiers.map((t) => (
                    <div key={t.minUnits} className={styles.pcRow}>
                      <span className={styles.pcRowLabel}>
                        {t.minUnits}+ portions
                      </span>
                      <span className={styles.pcRowVal}>{t.savingsLabel}</span>
                    </div>
                  ))}
                </div>
              )}
              {(listing.minOrderQty || listing.maxOrderQty) && (
                <div className={styles.pcSection}>
                  <span className={styles.pcHead}>Order range</span>
                  {listing.minOrderQty && (
                    <div className={styles.pcRow}>
                      <span className={styles.pcRowLabel}>Minimum</span>
                      <span className={styles.pcRowVal}>
                        {listing.minOrderQty} portions
                      </span>
                    </div>
                  )}
                  {listing.maxOrderQty && (
                    <div className={styles.pcRow}>
                      <span className={styles.pcRowLabel}>Maximum</span>
                      <span className={styles.pcRowVal}>
                        {listing.maxOrderQty} portions
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* ── Mobile sticky bar ────────────────────────────────────────────── */}
      {(hasSelection || isInCart) && (
        <div className={styles.mobileBar}>
          <div className={styles.mobileBarInfo}>
            {isInCart && !isModifying ? (
              <>
                <span className={styles.mobileBarCount}>In cart</span>
                <span className={styles.mobileBarTotal}>
                  ${selectionTotal.toFixed(2)}
                </span>
              </>
            ) : (
              <>
                <span className={styles.mobileBarCount}>
                  {selectionCount} portion{selectionCount !== 1 ? "s" : ""}
                </span>
                <span className={styles.mobileBarTotal}>
                  ${selectionTotal.toFixed(2)}
                </span>
              </>
            )}
          </div>
          {isInCart && !isModifying ? (
            <div className={styles.mobileBarActions}>
              <button
                type="button"
                className={styles.mobileBarBtnOutline}
                onClick={startModifying}
              >
                Modify
              </button>
              <Link href="/app/cart" className={styles.mobileBarBtn}>
                View cart
              </Link>
            </div>
          ) : (
            <button
              type="button"
              className={`${styles.mobileBarBtn} ${!canAddToCart ? styles.mobileBarBtnDisabled : ""}`}
              onClick={handleAddToCart}
              disabled={!canAddToCart}
            >
              {isInCart && isModifying ? "Update cart" : "Add to cart"}
            </button>
          )}
        </div>
      )}

      {/* Dish detail modal */}
      {selectedDish && (
        <DishModal
          dish={selectedDish}
          quantity={getQty(selectedDish.id)}
          orderLocked={orderLocked}
          onClose={() => setSelectedDish(null)}
          onAdd={(dish) => handleAdd(dish)}
          onDecrement={(dish) => handleDecrement(dish)}
        />
      )}
    </div>
  );
}
