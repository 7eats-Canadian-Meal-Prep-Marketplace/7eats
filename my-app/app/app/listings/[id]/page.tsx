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
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../../_cart-context";
import {
  type DietaryBadge,
  MOCK_COOKS,
  MOCK_LISTING_REVIEWS,
  MOCK_LISTINGS,
  type MockDish,
} from "../../_mock";
import { DealCallout } from "./_DealCallout";
import DishModal from "./_DishModal";
import styles from "./page.module.css";

function badgeLabel(badge: DietaryBadge): string {
  const map: Record<DietaryBadge, string> = {
    halal: "Halal",
    vegan: "Vegan",
    vegetarian: "Vegetarian",
    "gluten-free": "Gluten-free",
    "dairy-free": "Dairy-free",
    "nut-free": "Nut-free",
    kosher: "Kosher",
  };
  return map[badge];
}

export default function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const listing = MOCK_LISTINGS.find((l) => l.id === id) ?? MOCK_LISTINGS[0];
  const cook = MOCK_COOKS.find((c) => c.id === listing.cookId) ?? MOCK_COOKS[0];
  const reviews = MOCK_LISTING_REVIEWS[listing.id] ?? [];
  const { setListingItems, items } = useCart();
  // Subscribe mode: only available when listing has subscriptionEnabled
  const [subscribeMode, setSubscribeMode] = useState(false);
  // Local fulfillment mode — only used when listing supports both pickup + delivery.
  // Initialized from the cart item if already added, otherwise defaults to pickup.
  const [localFulfillment, setLocalFulfillment] = useState<
    "pickup" | "delivery"
  >("pickup");
  const router = useRouter();
  const wasInCartRef = useRef(false);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedDish, setSelectedDish] = useState<MockDish | null>(null);
  const [isModifying, setIsModifying] = useState(false);

  const isInCart = useMemo(
    () => items.some((i) => i.listingId === listing.id),
    [items, listing.id],
  );
  const orderLocked = isInCart && !isModifying;

  const getQty = (dishId: string) => quantities[dishId] ?? 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: listing.id is an intentional trigger dep — effect resets state when the listing changes
  useEffect(() => {
    wasInCartRef.current = false;
    setQuantities({});
    setSelectedDish(null);
    setIsModifying(false);
  }, [listing.id]);

  // Sync read-only view when this listing is already in the cart
  useEffect(() => {
    const fromCart = items.filter((i) => i.listingId === listing.id);
    if (fromCart.length > 0) {
      const next: Record<string, number> = {};
      for (const line of fromCart) next[line.dishId] = line.quantity;
      setQuantities(next);
      // Restore modes from the existing cart item
      setSubscribeMode(fromCart[0].orderType === "subscription");
      if (listing.fulfillment === "both") {
        setLocalFulfillment(fromCart[0].fulfillmentMode);
      }
      wasInCartRef.current = true;
      return;
    }
    if (wasInCartRef.current) {
      setQuantities({});
      setSubscribeMode(false);
      setLocalFulfillment("pickup");
      wasInCartRef.current = false;
      setIsModifying(false);
    }
  }, [listing.id, listing.fulfillment, items]);

  const restoreFromCart = () => {
    const fromCart = items.filter((i) => i.listingId === listing.id);
    const next: Record<string, number> = {};
    for (const line of fromCart) next[line.dishId] = line.quantity;
    // Restore modes so toggles reflect the current cart state
    if (fromCart.length > 0) {
      setSubscribeMode(fromCart[0].orderType === "subscription");
      if (listing.fulfillment === "both")
        setLocalFulfillment(fromCart[0].fulfillmentMode);
    }
    setQuantities(next);
  };

  const selectionCount = useMemo(
    () => Object.values(quantities).reduce((sum, q) => sum + q, 0),
    [quantities],
  );

  const handleAdd = (dish: MockDish) => {
    if (orderLocked) return;
    setQuantities((prev) => {
      const current = Object.values(prev).reduce((s, q) => s + q, 0);
      if (listing.maxUnits !== undefined && current >= listing.maxUnits)
        return prev;
      const newQty = (prev[dish.id] ?? 0) + 1;
      return { ...prev, [dish.id]: newQty };
    });
  };

  const handleDecrement = (dish: MockDish) => {
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

  // Resolve fulfillmentMode: "both" listings use the explicit local selector;
  // fixed listings are always pickup or always delivery.
  const resolvedFulfillmentMode =
    listing.fulfillment === "both" ? localFulfillment : listing.fulfillment;

  const buildCartLines = () =>
    listing.dishes
      .filter((dish) => getQty(dish.id) > 0)
      .map((dish) => ({
        dishId: dish.id,
        dishName: dish.name,
        dishEmoji: dish.emoji,
        listingId: listing.id,
        listingTitle: listing.title,
        orderType: (subscribeMode ? "subscription" : "one_time") as
          | "one_time"
          | "subscription",
        fulfillmentMode: resolvedFulfillmentMode,
        cookId: cook.id,
        cookName: cook.displayName,
        cookInitials: cook.initials,
        cookGradient: cook.gradient,
        price: dish.price,
        quantity: getQty(dish.id),
      }));

  const spotsLeft = listing.ordersLeft;
  const spotsLow = spotsLeft <= 3;
  const fillPct = Math.round(
    ((listing.maxOrders - spotsLeft) / listing.maxOrders) * 100,
  );

  const hasSelection = selectionCount > 0;
  const selectionTotal = listing.dishes.reduce(
    (sum, dish) => sum + dish.price * getQty(dish.id),
    0,
  );
  const meetsMinUnits = !listing.minUnits || selectionCount >= listing.minUnits;
  const atMaxUnits =
    listing.maxUnits !== undefined && selectionCount >= listing.maxUnits;
  const canAddToCart = hasSelection && meetsMinUnits;
  const unitsNeeded = listing.minUnits
    ? Math.max(0, listing.minUnits - selectionCount)
    : 0;

  const hasPolicy =
    listing.deal ||
    (listing.priceTiers && listing.priceTiers.length > 0) ||
    listing.minUnits ||
    listing.maxUnits;

  const handleAddToCart = () => {
    if (!canAddToCart) return;
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

  // Reusable cook bar markup used in both mobile inline and sidebar
  const cookBarContent = (
    <Link href={`/app/cooks/${cook.id}`} className={styles.cookBar}>
      <div className={styles.cookAvatar} style={{ background: cook.gradient }}>
        {cook.initials}
      </div>
      <div className={styles.cookInfo}>
        <span className={styles.cookName}>{cook.displayName}</span>
        <span className={styles.cookMeta}>
          {cook.cuisineTypes.join(", ")} · {cook.neighborhood}, Toronto
        </span>
      </div>
      {cook.verified && (
        <CheckCircle size={16} className={styles.verifiedIcon} />
      )}
      <div className={styles.cookRating}>
        <Star size={13} fill="currentColor" className={styles.ratingStar} />
        <span className={styles.ratingNum}>{cook.rating}</span>
        <span className={styles.ratingCount}>({cook.reviewCount})</span>
      </div>
    </Link>
  );

  return (
    <div className={styles.page}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        {/* biome-ignore lint/performance/noImgElement: listing hero */}
        <img
          src="/placeholder.jpg"
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
        {listing.deal && (
          <div className={styles.heroDeal}>{listing.deal.badge}</div>
        )}
      </div>

      {/* ── Two-column ───────────────────────────────────────────────────── */}
      <div className={styles.content}>
        {/* ── LEFT: food-first ─────────────────────────────────────────── */}
        <div className={styles.main}>
          <h1 className={styles.title}>{listing.title}</h1>
          {reviews.length > 0 && (
            <div className={styles.titleMeta}>
              <Star
                size={13}
                fill="currentColor"
                className={styles.titleStar}
              />
              <span className={styles.titleRating}>{cook.rating}</span>
              <span className={styles.titleDot}>·</span>
              <a href="#reviews" className={styles.reviewsLink}>
                {cook.reviewCount} reviews
              </a>
            </div>
          )}
          <p className={styles.desc}>{listing.description}</p>

          {/* Subscription availability banner */}
          {listing.subscriptionEnabled && (
            <div className={styles.subscriptionInfo}>
              <RefreshCw size={14} className={styles.subscriptionIcon} />
              <div>
                <span className={styles.subscriptionTitle}>
                  Weekly subscriptions available
                </span>
                <span className={styles.subscriptionDetail}>
                  Subscribe and get this automatically every week. Cancel any
                  time.
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
                  <div className={styles.pickupLabel}>Pickup</div>
                  <div className={styles.pickupVal}>
                    {listing.pickupDateFull} · {listing.pickupWindow}
                  </div>
                </div>
              </div>
              <div className={styles.pickupItem}>
                <ShoppingBag size={16} className={styles.pickupIcon} />
                <div>
                  <div className={styles.pickupLabel}>Order by</div>
                  <div
                    className={`${styles.pickupVal} ${spotsLow ? styles.urgent : ""}`}
                  >
                    {listing.orderDeadline}
                  </div>
                </div>
              </div>
              <div className={styles.pickupItem}>
                <MapPin size={16} className={styles.pickupIcon} />
                <div>
                  <div className={styles.pickupLabel}>Location</div>
                  <div className={styles.pickupVal}>
                    {cook.neighborhood}, Toronto
                  </div>
                </div>
              </div>
            </div>
            {hasPolicy && (
              <>
                <hr className={styles.rule} />
                <div className={styles.policySection}>
                  {listing.deal && (
                    <div className={styles.dealCallout}>
                      <p className={styles.dealCalloutBadge}>
                        {listing.deal.badge}
                      </p>
                    </div>
                  )}
                  {listing.priceTiers && listing.priceTiers.length > 0 && (
                    <div className={styles.policyRow}>
                      <TrendingDown size={15} className={styles.policyIcon} />
                      <div className={styles.policyBody}>
                        <span className={styles.policyTitle}>
                          Volume discount
                        </span>
                        <span className={styles.policyDesc}>
                          {listing.priceTiers
                            .map((t) => `${t.minUnits}+: ${t.savingsLabel}`)
                            .join("  ·  ")}
                        </span>
                      </div>
                    </div>
                  )}
                  {(listing.minUnits || listing.maxUnits) && (
                    <div className={styles.policyRow}>
                      <Info size={15} className={styles.policyIcon} />
                      <div className={styles.policyBody}>
                        <span className={styles.policyTitle}>
                          {listing.minUnits && listing.maxUnits
                            ? `${listing.minUnits}–${listing.maxUnits} portions per order`
                            : listing.minUnits
                              ? `Minimum ${listing.minUnits} portions`
                              : `Maximum ${listing.maxUnits} portions`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <hr className={styles.rule} />

          {/* ── Menu (immediately visible) ─────────────────────────────── */}
          <h2 className={styles.sectionTitle}>What&apos;s on the menu</h2>
          <div className={styles.dishes}>
            {listing.dishes.map((dish) => {
              const qty = getQty(dish.id);
              const atListingMax =
                !orderLocked &&
                listing.maxUnits !== undefined &&
                selectionCount >= listing.maxUnits &&
                qty === 0;
              const controlsLocked = orderLocked || atMaxUnits;
              return (
                /* biome-ignore lint/a11y/useSemanticElements: contains nested buttons — a <button> cannot have <button> children */
                <div
                  key={dish.id}
                  className={styles.dishCard}
                  onClick={() => setSelectedDish(dish)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      setSelectedDish(dish);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${dish.name} details`}
                >
                  <div className={styles.dishCover}>
                    {/* biome-ignore lint/performance/noImgElement: mock placeholder */}
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
                        <p className={styles.dishDesc}>{dish.description}</p>
                        <div className={styles.dishTags}>
                          <span className={styles.portion}>
                            {dish.portionSize}
                          </span>
                          {dish.badges.map((b) => (
                            <span key={b} className={styles.dishBadge}>
                              {badgeLabel(b)}
                            </span>
                          ))}
                        </div>
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
                            onClick={() => handleAdd(dish)}
                            disabled={atListingMax || orderLocked}
                            aria-label={`Add ${dish.name}`}
                          >
                            <Plus size={16} strokeWidth={2.5} />
                          </button>
                        ) : (
                          <div className={styles.qtyControl}>
                            <button
                              type="button"
                              className={`${styles.qtyBtn} ${orderLocked ? styles.qtyBtnDisabled : ""}`}
                              onClick={() => handleDecrement(dish)}
                              disabled={orderLocked}
                            >
                              <Minus size={14} />
                            </button>
                            <span className={styles.qtyNum}>{qty}</span>
                            <button
                              type="button"
                              className={`${styles.qtyBtn} ${controlsLocked ? styles.qtyBtnDisabled : ""}`}
                              onClick={() => handleAdd(dish)}
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
                  {cook.rating} · {cook.reviewCount} reviews
                </h2>
                <div className={styles.reviewList}>
                  {reviews.map((review) => (
                    <div key={review.id} className={styles.reviewCard}>
                      <div className={styles.reviewTop}>
                        <div className={styles.reviewerAvatar}>
                          {review.clientInitials}
                        </div>
                        <div className={styles.reviewerInfo}>
                          <span className={styles.reviewerName}>
                            {review.clientName}
                          </span>
                          <span className={styles.reviewDate}>
                            {review.date}
                          </span>
                        </div>
                        <div className={styles.reviewStars}>
                          {Array.from({ length: 5 }, (_, i) => i).map((i) => (
                            <Star
                              key={`star-${i}`}
                              size={12}
                              fill={i < review.rating ? "currentColor" : "none"}
                              className={
                                i < review.rating
                                  ? styles.starFilled
                                  : styles.starEmpty
                              }
                            />
                          ))}
                        </div>
                      </div>
                      <p className={styles.reviewComment}>{review.comment}</p>
                      <span className={styles.reviewDish}>
                        {review.orderedDish}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* ── RIGHT: three stacked cards ───────────────────────────────── */}
        <aside className={styles.sidebar}>
          {/* Card 1 — Order widget */}
          <div className={styles.orderCard}>
            {/* Pickup / Delivery selector — only for listings that support both */}
            {listing.fulfillment === "both" && (
              <div className={styles.fulfillmentToggle}>
                <button
                  type="button"
                  className={`${styles.fulfillmentBtn} ${localFulfillment === "pickup" ? styles.fulfillmentBtnActive : ""}`}
                  onClick={() => setLocalFulfillment("pickup")}
                  disabled={orderLocked}
                >
                  Pickup
                </button>
                <button
                  type="button"
                  className={`${styles.fulfillmentBtn} ${localFulfillment === "delivery" ? styles.fulfillmentBtnActive : ""}`}
                  onClick={() => setLocalFulfillment("delivery")}
                  disabled={orderLocked}
                >
                  Delivery
                </button>
              </div>
            )}

            <div className={styles.logisticsGrid}>
              <span className={styles.logLabel}>From</span>
              <span className={styles.logVal}>
                ${listing.priceFrom} / portion
              </span>
              <span className={styles.logLabel}>Pickup</span>
              <div className={styles.logValues}>
                <span className={styles.logVal}>{listing.pickupDateFull}</span>
                <span className={styles.logMeta}>{listing.pickupWindow}</span>
              </div>
              <span className={styles.logLabel}>Order by</span>
              <span
                className={`${styles.logVal} ${spotsLow ? styles.urgent : ""}`}
              >
                {listing.orderDeadline}
              </span>
            </div>

            <div className={styles.spotsSection}>
              <span
                className={`${styles.spotsText} ${spotsLow ? styles.urgent : ""}`}
              >
                {spotsLeft} left
              </span>
              <div className={styles.spotsTrack}>
                <div
                  className={`${styles.spotsTrackFill} ${spotsLow ? styles.spotsTrackFillLow : ""}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
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
                        ${dish.price * getQty(dish.id)}
                      </span>
                    </div>
                  ))}
                <div className={styles.summaryTotal}>
                  <span>Total</span>
                  <span>${selectionTotal}.00</span>
                </div>
              </div>
            )}

            <div className={styles.ctaWrap}>
              {/* Order mode toggle + disclaimer live inside the padded CTA zone */}
              {listing.subscriptionEnabled && (!isInCart || isModifying) && (
                <div className={styles.orderModeToggle}>
                  <button
                    type="button"
                    className={`${styles.orderModeBtn} ${!subscribeMode ? styles.orderModeBtnActive : ""}`}
                    onClick={() => setSubscribeMode(false)}
                  >
                    Order once
                  </button>
                  <button
                    type="button"
                    className={`${styles.orderModeBtn} ${subscribeMode ? styles.orderModeBtnActive : ""}`}
                    onClick={() => setSubscribeMode(true)}
                  >
                    <RefreshCw size={11} />
                    Subscribe weekly
                  </button>
                </div>
              )}

              {subscribeMode && (
                <p className={styles.weeklyNote}>
                  <RefreshCw size={11} />
                  Charged every week · cancel any time
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
                          ? `Update cart · $${selectionTotal}.00`
                          : subscribeMode
                            ? `Subscribe weekly · $${selectionTotal}.00/wk`
                            : `Add to cart · $${selectionTotal}.00`}
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
                style={{ background: cook.gradient }}
              >
                {cook.initials}
              </div>
              <div className={styles.cookCardBody}>
                <div className={styles.cookCardTop}>
                  <span className={styles.cookCardName}>
                    {cook.displayName}
                  </span>
                  {cook.verified && (
                    <CheckCircle
                      size={14}
                      className={styles.cookCardVerified}
                    />
                  )}
                </div>
                <span className={styles.cookCardMeta}>
                  {cook.cuisineTypes.join(", ")} · {cook.neighborhood}, Toronto
                </span>
                <div className={styles.cookCardStats}>
                  <Star
                    size={12}
                    fill="currentColor"
                    className={styles.ratingStar}
                  />
                  <span className={styles.cookCardRating}>{cook.rating}</span>
                  <span className={styles.cookCardReviews}>
                    ({cook.reviewCount} reviews)
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Card 3 — Bundle deals & order policy (only when applicable) */}
          {hasPolicy && (
            <div className={styles.policyCard}>
              {listing.deal && <DealCallout deal={listing.deal} />}
              {listing.priceTiers && listing.priceTiers.length > 0 && (
                <div className={styles.pcSection}>
                  <span className={styles.pcHead}>Volume savings</span>
                  {listing.priceTiers.map((t) => (
                    <div key={t.minUnits} className={styles.pcRow}>
                      <span className={styles.pcRowLabel}>
                        {t.minUnits}+ portions
                      </span>
                      <span className={styles.pcRowVal}>{t.savingsLabel}</span>
                    </div>
                  ))}
                </div>
              )}
              {(listing.minUnits || listing.maxUnits) && (
                <div className={styles.pcSection}>
                  <span className={styles.pcHead}>Order range</span>
                  {listing.minUnits && (
                    <div className={styles.pcRow}>
                      <span className={styles.pcRowLabel}>Minimum</span>
                      <span className={styles.pcRowVal}>
                        {listing.minUnits} portions
                      </span>
                    </div>
                  )}
                  {listing.maxUnits && (
                    <div className={styles.pcRow}>
                      <span className={styles.pcRowLabel}>Maximum</span>
                      <span className={styles.pcRowVal}>
                        {listing.maxUnits} portions
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
                  ${selectionTotal}.00
                </span>
              </>
            ) : (
              <>
                <span className={styles.mobileBarCount}>
                  {selectionCount} portion{selectionCount !== 1 ? "s" : ""}
                </span>
                <span className={styles.mobileBarTotal}>
                  ${selectionTotal}.00
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
