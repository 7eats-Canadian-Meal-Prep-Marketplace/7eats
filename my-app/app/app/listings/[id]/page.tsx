"use client";

import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Info,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  Tag,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useCart } from "../../_cart-context";
import {
  type DietaryBadge,
  MOCK_COOKS,
  MOCK_LISTING_REVIEWS,
  MOCK_LISTINGS,
  type MockDish,
} from "../../_mock";
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
  const { addItem, updateQuantity, items } = useCart();
  const router = useRouter();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedDish, setSelectedDish] = useState<MockDish | null>(null);

  const getQty = (dishId: string) => quantities[dishId] ?? 0;

  const handleAdd = (dish: MockDish) => {
    const currentTotal = items
      .filter((i) => i.listingId === listing.id)
      .reduce((s, i) => s + i.quantity, 0);
    if (listing.maxUnits !== undefined && currentTotal >= listing.maxUnits)
      return;
    const newQty = getQty(dish.id) + 1;
    setQuantities((prev) => ({ ...prev, [dish.id]: newQty }));
    addItem({
      dishId: dish.id,
      dishName: dish.name,
      dishEmoji: dish.emoji,
      listingId: listing.id,
      listingTitle: listing.title,
      cookId: cook.id,
      cookName: cook.displayName,
      cookInitials: cook.initials,
      cookGradient: cook.gradient,
      price: dish.price,
    });
  };

  const handleDecrement = (dish: MockDish) => {
    const newQty = Math.max(0, getQty(dish.id) - 1);
    setQuantities((prev) => ({ ...prev, [dish.id]: newQty }));
    updateQuantity(dish.id, newQty);
  };

  const spotsLeft = listing.ordersLeft;
  const spotsLow = spotsLeft <= 3;
  const fillPct = Math.round(
    ((listing.maxOrders - spotsLeft) / listing.maxOrders) * 100,
  );

  const hasItems = items.some((i) => i.listingId === listing.id);
  const cartItems = items.filter((i) => i.listingId === listing.id);
  const listingTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const listingCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const meetsMinUnits = !listing.minUnits || listingCount >= listing.minUnits;
  const atMaxUnits =
    listing.maxUnits !== undefined && listingCount >= listing.maxUnits;
  const canCheckout = hasItems && meetsMinUnits;
  const unitsNeeded = listing.minUnits
    ? Math.max(0, listing.minUnits - listingCount)
    : 0;

  const hasPolicy =
    listing.deal ||
    (listing.priceTiers && listing.priceTiers.length > 0) ||
    listing.minUnits ||
    listing.maxUnits;

  const handleCtaClick = () => {
    if (canCheckout) router.push("/app/cart");
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
        <Link href="/app/browse" className={styles.backBtn} aria-label="Back">
          <ArrowLeft size={20} />
        </Link>
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
                    <div
                      className={`${styles.policyRow} ${styles.policyRowDeal}`}
                    >
                      <Tag size={15} className={styles.policyIconDeal} />
                      <div className={styles.policyBody}>
                        <span className={styles.policyTitle}>
                          {listing.deal.badge}
                        </span>
                        <span className={styles.policyDesc}>
                          {listing.deal.label}
                        </span>
                      </div>
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
                listing.maxUnits !== undefined &&
                listingCount >= listing.maxUnits &&
                qty === 0;
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
                            className={`${styles.addBtn} ${atListingMax ? styles.addBtnDisabled : ""}`}
                            onClick={() => handleAdd(dish)}
                            disabled={atListingMax}
                            aria-label={`Add ${dish.name}`}
                          >
                            <Plus size={16} strokeWidth={2.5} />
                          </button>
                        ) : (
                          <div className={styles.qtyControl}>
                            <button
                              type="button"
                              className={styles.qtyBtn}
                              onClick={() => handleDecrement(dish)}
                            >
                              <Minus size={14} />
                            </button>
                            <span className={styles.qtyNum}>{qty}</span>
                            <button
                              type="button"
                              className={`${styles.qtyBtn} ${atMaxUnits ? styles.qtyBtnDisabled : ""}`}
                              onClick={() => handleAdd(dish)}
                              disabled={atMaxUnits}
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

            {hasItems && (
              <div className={styles.bookingSummary}>
                <hr className={styles.bookingRule} />
                {cartItems.map((item) => (
                  <div key={item.dishId} className={styles.summaryRow}>
                    <span className={styles.summaryName}>
                      {item.quantity}× {item.dishName}
                    </span>
                    <span className={styles.summaryPrice}>
                      ${item.price * item.quantity}
                    </span>
                  </div>
                ))}
                <div className={styles.summaryTotal}>
                  <span>Total</span>
                  <span>${listingTotal}.00</span>
                </div>
              </div>
            )}

            <div className={styles.ctaWrap}>
              <button
                type="button"
                className={`${styles.ctaBtn} ${canCheckout ? styles.ctaBtnActive : ""}`}
                onClick={handleCtaClick}
              >
                {canCheckout
                  ? `Review order · $${listingTotal}.00`
                  : !hasItems
                    ? "Select dishes to order"
                    : `Add ${unitsNeeded} more portion${unitsNeeded !== 1 ? "s" : ""} to continue`}
              </button>
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
              {listing.deal && (
                <div className={styles.pcDeal}>
                  <span className={styles.pcDealBadge}>
                    <Tag size={10} />
                    {listing.deal.badge}
                  </span>
                  <p className={styles.pcDealDesc}>{listing.deal.label}</p>
                </div>
              )}
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
      {hasItems && (
        <div className={styles.mobileBar}>
          <div className={styles.mobileBarInfo}>
            <span className={styles.mobileBarCount}>
              {listingCount} dish{listingCount !== 1 ? "es" : ""}
            </span>
            <span className={styles.mobileBarTotal}>${listingTotal}.00</span>
          </div>
          <Link href="/app/cart" className={styles.mobileBarBtn}>
            View cart →
          </Link>
        </div>
      )}

      {/* Dish detail modal */}
      {selectedDish && (
        <DishModal
          dish={selectedDish}
          quantity={getQty(selectedDish.id)}
          onClose={() => setSelectedDish(null)}
          onAdd={(dish) => handleAdd(dish)}
          onDecrement={(dish) => handleDecrement(dish)}
        />
      )}
    </div>
  );
}
