"use client";

import {
  ArrowLeft,
  Clock,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Star,
} from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { useCart } from "../../_cart-context";
import {
  type DietaryBadge,
  MOCK_COOKS,
  MOCK_LISTINGS,
  type MockDish,
} from "../../_mock";
import styles from "./page.module.css";

function badgeLabel(badge: DietaryBadge): string {
  const map: Record<DietaryBadge, string> = {
    halal: "🌙 Halal",
    vegan: "🌿 Vegan",
    vegetarian: "🥦 Vegetarian",
    "gluten-free": "🌾 Gluten-free",
    "dairy-free": "🥛 Dairy-free",
    "nut-free": "🥜 Nut-free",
    kosher: "✡ Kosher",
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
  const { addItem, updateQuantity, items } = useCart();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"menu" | "about">("menu");

  const getQty = (dishId: string) => quantities[dishId] ?? 0;

  const handleAdd = (dish: MockDish) => {
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
  const hasItemsFromThisListing = items.some((i) => i.listingId === listing.id);
  const listingTotal = items
    .filter((i) => i.listingId === listing.id)
    .reduce((s, i) => s + i.price * i.quantity, 0);
  const listingCount = items
    .filter((i) => i.listingId === listing.id)
    .reduce((s, i) => s + i.quantity, 0);

  return (
    <div className={styles.page}>
      {/* Hero banner */}
      <div className={styles.hero} style={{ background: listing.gradient }}>
        <div className={styles.heroNav}>
          <Link href="/app/browse" className={styles.backBtn}>
            <ArrowLeft size={20} />
          </Link>
        </div>
        <div className={styles.heroContent}>
          <span className={styles.heroEmoji}>{listing.emoji}</span>
        </div>
        {spotsLow && spotsLeft > 0 && (
          <div className={styles.heroUrgency}>
            🔴 Only {spotsLeft} spot{spotsLeft > 1 ? "s" : ""} left
          </div>
        )}
      </div>

      {/* Main content */}
      <div className={styles.body}>
        {/* Info panel */}
        <div className={styles.info}>
          <div className={styles.infoHeader}>
            <div>
              <h1 className={styles.title}>{listing.title}</h1>
              <Link href={`/app/cooks/${cook.id}`} className={styles.cookRow}>
                <div
                  className={styles.cookAvatar}
                  style={{ background: cook.gradient }}
                >
                  {cook.initials}
                </div>
                <div className={styles.cookDetails}>
                  <span className={styles.cookName}>{cook.displayName}</span>
                  <span className={styles.cookMeta}>
                    {cook.cuisineTypes.join(", ")} · {cook.neighborhood}
                  </span>
                </div>
                <div className={styles.cookRating}>
                  <Star size={13} fill="currentColor" className={styles.star} />
                  <span>{cook.rating}</span>
                  <span className={styles.reviewCount}>
                    ({cook.reviewCount})
                  </span>
                </div>
              </Link>
            </div>
          </div>

          {/* Pickup info strip */}
          <div className={styles.pickupStrip}>
            <div className={styles.pickupItem}>
              <Clock size={15} className={styles.pickupIcon} />
              <div>
                <div className={styles.pickupLabel}>Pickup</div>
                <div className={styles.pickupVal}>
                  {listing.pickupDateFull} · {listing.pickupWindow}
                </div>
              </div>
            </div>
            <div className={styles.pickupItem}>
              <ShoppingBag size={15} className={styles.pickupIcon} />
              <div>
                <div className={styles.pickupLabel}>Order by</div>
                <div
                  className={`${styles.pickupVal} ${spotsLow ? styles.pickupUrgent : ""}`}
                >
                  {listing.orderDeadline}
                </div>
              </div>
            </div>
            <div className={styles.pickupItem}>
              <MapPin size={15} className={styles.pickupIcon} />
              <div>
                <div className={styles.pickupLabel}>Location</div>
                <div className={styles.pickupVal}>
                  {cook.neighborhood}, Toronto
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === "menu" ? styles.tabActive : ""}`}
            onClick={() => setTab("menu")}
          >
            Menu
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === "about" ? styles.tabActive : ""}`}
            onClick={() => setTab("about")}
          >
            About the cook
          </button>
        </div>

        {/* Tab content */}
        {tab === "menu" && (
          <div className={styles.tabContent}>
            <p className={styles.listingDesc}>{listing.description}</p>
            <div className={styles.dishes}>
              {listing.dishes.map((dish) => {
                const qty = getQty(dish.id);
                return (
                  <div key={dish.id} className={styles.dishCard}>
                    <div className={styles.dishCover}>
                      <span className={styles.dishEmoji}>{dish.emoji}</span>
                    </div>
                    <div className={styles.dishBody}>
                      <div className={styles.dishTop}>
                        <div>
                          <h3 className={styles.dishName}>{dish.name}</h3>
                          <p className={styles.dishDesc}>{dish.description}</p>
                          <div className={styles.dishBadges}>
                            {dish.badges.map((b) => (
                              <span key={b} className={styles.dishBadge}>
                                {badgeLabel(b)}
                              </span>
                            ))}
                            <span className={styles.portionSize}>
                              {dish.portionSize}
                            </span>
                          </div>
                        </div>
                        <div className={styles.dishRight}>
                          <span className={styles.dishPrice}>
                            ${dish.price}
                          </span>
                          {qty === 0 ? (
                            <button
                              type="button"
                              className={styles.addBtn}
                              onClick={() => handleAdd(dish)}
                            >
                              Add
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
                                className={styles.qtyBtn}
                                onClick={() => handleAdd(dish)}
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
          </div>
        )}

        {tab === "about" && (
          <div className={styles.tabContent}>
            <div className={styles.aboutSection}>
              <div
                className={styles.aboutAvatar}
                style={{ background: cook.gradient }}
              >
                {cook.initials}
              </div>
              <h2 className={styles.aboutName}>{cook.displayName}</h2>
              <p className={styles.aboutMeta}>
                {cook.cuisineTypes.join(" · ")} · {cook.neighborhood}, Toronto
              </p>
              {cook.verified && (
                <span className={styles.verifiedBadge}>✓ Verified cook</span>
              )}
              <p className={styles.aboutBio}>{cook.bio}</p>

              <div className={styles.aboutStats}>
                <div className={styles.stat}>
                  <span className={styles.statVal}>{cook.rating}</span>
                  <span className={styles.statLabel}>Rating</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <span className={styles.statVal}>{cook.reviewCount}</span>
                  <span className={styles.statLabel}>Reviews</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <span className={styles.statVal}>
                    {cook.leadTime.replace("Order ", "")}
                  </span>
                  <span className={styles.statLabel}>Lead time</span>
                </div>
              </div>

              <div className={styles.aboutBadges}>
                {cook.badges.map((b) => (
                  <span key={b} className={styles.dishBadge}>
                    {badgeLabel(b)}
                  </span>
                ))}
              </div>

              <Link
                href={`/app/cooks/${cook.id}`}
                className={styles.viewProfileBtn}
              >
                View full profile →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Sticky cart bar */}
      {hasItemsFromThisListing && (
        <div className={styles.stickyBar}>
          <div className={styles.stickyContent}>
            <div className={styles.stickyInfo}>
              <span className={styles.stickyCount}>
                {listingCount} item{listingCount !== 1 ? "s" : ""}
              </span>
              <span className={styles.stickyTotal}>${listingTotal}.00</span>
            </div>
            <Link href="/app/cart" className={styles.stickyBtn}>
              View cart →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
