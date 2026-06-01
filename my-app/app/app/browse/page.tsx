"use client";

import { Heart, MapPin, Search, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  type CuisineType,
  type DietaryBadge,
  MOCK_COOKS,
  MOCK_LISTINGS,
} from "../_mock";
import styles from "./page.module.css";

const CUISINE_FILTERS: { label: string; value: CuisineType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "West African", value: "West African" },
  { label: "Korean", value: "Korean" },
  { label: "Middle Eastern", value: "Middle Eastern" },
  { label: "Brazilian", value: "Brazilian" },
  { label: "Italian", value: "Italian" },
];

const DIETARY_FILTERS: { label: string; emoji: string; value: DietaryBadge }[] =
  [
    { label: "Halal", emoji: "🌙", value: "halal" },
    { label: "Vegetarian", emoji: "🥦", value: "vegetarian" },
    { label: "Vegan", emoji: "🌿", value: "vegan" },
    { label: "Gluten-free", emoji: "🌾", value: "gluten-free" },
  ];

function badgeLabel(badge: DietaryBadge): string {
  const map: Record<DietaryBadge, string> = {
    halal: "🌙 Halal",
    vegan: "🌿 Vegan",
    vegetarian: "🥦 Veggie",
    "gluten-free": "🌾 GF",
    "dairy-free": "🥛 DF",
    "nut-free": "🥜 NF",
    kosher: "✡ Kosher",
  };
  return map[badge];
}

export default function BrowsePage() {
  const [cuisine, setCuisine] = useState<CuisineType | "all">("all");
  const [dietary, setDietary] = useState<Set<DietaryBadge>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const toggleDietary = (badge: DietaryBadge) => {
    setSaved((s) => s); // keep saved stable
    setDietary((prev) => {
      const next = new Set(prev);
      if (next.has(badge)) next.delete(badge);
      else next.add(badge);
      return next;
    });
  };

  const toggleSave = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = MOCK_LISTINGS.filter((listing) => {
    if (cuisine !== "all" && !listing.cuisineTypes.includes(cuisine))
      return false;
    if (dietary.size > 0) {
      const allDishes = listing.dishes;
      for (const badge of dietary) {
        const hasAll = allDishes.some((d) => d.badges.includes(badge));
        if (!hasAll) return false;
      }
    }
    return true;
  });

  const urgent = filtered.filter((l) => l.ordersLeft <= 4);
  const rest = filtered.filter((l) => l.ordersLeft > 4);

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heading}>
            Real home cooking,{" "}
            <span className={styles.headingAccent}>near you.</span>
          </h1>
          <div className={styles.searchRow}>
            <div className={styles.searchBar}>
              <Search size={18} className={styles.searchIcon} />
              <span className={styles.searchPlaceholder}>
                What are you craving?
              </span>
            </div>
            <div className={styles.locationChip}>
              <MapPin size={13} />
              Toronto, ON
            </div>
          </div>
        </div>
      </div>

      {/* Cuisine filter */}
      <div className={styles.filterBar}>
        <div className={styles.filterInner}>
          {CUISINE_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              className={`${styles.chip} ${cuisine === value ? styles.chipActive : ""}`}
              onClick={() => setCuisine(value)}
            >
              {label}
            </button>
          ))}

          <div className={styles.filterDivider} />

          {DIETARY_FILTERS.map(({ label, emoji, value }) => (
            <button
              key={value}
              type="button"
              className={`${styles.chip} ${dietary.has(value) ? styles.chipRed : ""}`}
              onClick={() => toggleDietary(value)}
            >
              {emoji} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {filtered.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No listings match your filters</p>
            <p className={styles.emptyDesc}>
              Try removing a filter to see more options.
            </p>
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setCuisine("all");
                setDietary(new Set());
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Urgent / selling fast */}
        {urgent.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.urgentDot} /> Selling fast
            </h2>
            <div className={styles.grid}>
              {urgent.map((listing) => {
                const cook =
                  MOCK_COOKS.find((c) => c.id === listing.cookId) ??
                  MOCK_COOKS[0];
                return (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    cook={cook}
                    isSaved={saved.has(listing.id)}
                    onSave={toggleSave}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* All listings */}
        {rest.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {urgent.length > 0 ? "More listings" : "Available now"}
            </h2>
            <div className={styles.grid}>
              {rest.map((listing) => {
                const cook =
                  MOCK_COOKS.find((c) => c.id === listing.cookId) ??
                  MOCK_COOKS[0];
                return (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    cook={cook}
                    isSaved={saved.has(listing.id)}
                    onSave={toggleSave}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Meet the cooks section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Meet the cooks</h2>
          <div className={styles.cookRow}>
            {MOCK_COOKS.map((cook) => (
              <Link
                key={cook.id}
                href={`/app/cooks/${cook.id}`}
                className={styles.cookCard}
              >
                <div
                  className={styles.cookAvatar}
                  style={{ background: cook.gradient }}
                >
                  {cook.initials}
                </div>
                <span className={styles.cookCardName}>
                  {cook.displayName.split(" ")[0]}
                </span>
                <span className={styles.cookCardCuisine}>
                  {cook.cuisineTypes[0]}
                </span>
                <span className={styles.cookCardRating}>★ {cook.rating}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

type ListingCardProps = {
  listing: (typeof MOCK_LISTINGS)[0];
  cook: (typeof MOCK_COOKS)[0];
  isSaved: boolean;
  onSave: (id: string, e: React.MouseEvent) => void;
};

function ListingCard({ listing, cook, isSaved, onSave }: ListingCardProps) {
  const spotsLow = listing.ordersLeft <= 3;
  const spotsOut = listing.ordersLeft === 0;

  return (
    <Link href={`/app/listings/${listing.id}`} className={styles.card}>
      {/* Cover */}
      <div
        className={styles.cardCover}
        style={{ background: listing.gradient }}
      >
        <span className={styles.cardEmoji}>{listing.emoji}</span>

        {/* Save button */}
        <button
          type="button"
          className={`${styles.heartBtn} ${isSaved ? styles.heartBtnActive : ""}`}
          onClick={(e) => onSave(listing.id, e)}
          aria-label={isSaved ? "Remove from saved" : "Save listing"}
        >
          <Heart size={16} fill={isSaved ? "currentColor" : "none"} />
        </button>

        {/* Pickup pill */}
        <div className={styles.coverBottom}>
          <span className={styles.pickupPill}>📅 {listing.pickupDate}</span>
          {spotsOut ? (
            <span className={`${styles.spotsPill} ${styles.spotsSoldOut}`}>
              Sold out
            </span>
          ) : spotsLow ? (
            <span className={`${styles.spotsPill} ${styles.spotsLow}`}>
              {listing.ordersLeft} left!
            </span>
          ) : (
            <span className={`${styles.spotsPill} ${styles.spotsOk}`}>
              {listing.ordersLeft} spots
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <div className={styles.cookInfo}>
            <div
              className={styles.cookMiniAvatar}
              style={{ background: cook.gradient }}
            >
              {cook.initials}
            </div>
            <span className={styles.cookName}>{cook.displayName}</span>
          </div>
          <div className={styles.ratingRow}>
            <Star size={12} className={styles.star} fill="currentColor" />
            <span className={styles.ratingVal}>{cook.rating}</span>
          </div>
        </div>

        <h3 className={styles.cardTitle}>{listing.title}</h3>

        <div className={styles.cardMeta}>
          <span className={styles.priceFrom}>From ${listing.priceFrom}</span>
          {cook.badges.slice(0, 2).map((b) => (
            <span
              key={b}
              className={`${styles.badge} ${b === "halal" ? styles.badgeHalal : ""}`}
            >
              {badgeLabel(b)}
            </span>
          ))}
        </div>

        <div className={styles.cardFooter}>
          <span className={styles.deadline}>
            Order by{" "}
            <span className={spotsLow ? styles.deadlineUrgent : ""}>
              {listing.orderDeadlineShort}
            </span>
          </span>
          <span className={styles.preorderBtn}>
            {spotsOut ? "Sold out" : "Pre-order →"}
          </span>
        </div>
      </div>
    </Link>
  );
}
