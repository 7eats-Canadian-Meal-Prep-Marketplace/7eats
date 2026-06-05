"use client";

import {
  ChevronLeft,
  ChevronRight,
  Heart,
  RefreshCw,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../_app-context";
import { type FulfillmentMode, scheduleLine } from "../_listing-card-utils";
import {
  MOCK_COOKS,
  MOCK_LISTINGS,
  type MockCook,
  type MockListing,
} from "../_mock";
import { FulfillmentToggle } from "../_shell";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

function formatDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`;
}

function cookFor(listing: MockListing): MockCook {
  return MOCK_COOKS.find((c) => c.id === listing.cookId) ?? MOCK_COOKS[0];
}

function applyFilters(
  listings: MockListing[],
  mode: FulfillmentMode,
): MockListing[] {
  return listings.filter((l) => {
    if (l.fulfillment !== mode && l.fulfillment !== "both") return false;
    if (hoursUntil(l.orderDeadlineIso) <= 0) return false;
    return true;
  });
}

// ─── Options ──────────────────────────────────────────────────────────────────

const CUISINE_OPTIONS: { label: string; value: string }[] = [
  { label: "Search all", value: "all" },
  { label: "West African", value: "West African" },
  { label: "Korean", value: "Korean" },
  { label: "Middle Eastern", value: "Middle Eastern" },
  { label: "Brazilian", value: "Brazilian" },
  { label: "Italian", value: "Italian" },
  { label: "Caribbean", value: "Caribbean" },
  { label: "Japanese", value: "Japanese" },
  { label: "South Asian", value: "South Asian" },
];

// ─── Listing Card ─────────────────────────────────────────────────────────────

function ListingCard({
  listing,
  cook,
  isSaved,
  onSave,
  canSave,
  fulfillment,
}: {
  listing: MockListing;
  cook: MockCook;
  isSaved: boolean;
  onSave: (id: string, e: React.MouseEvent) => void;
  canSave: boolean;
  fulfillment: FulfillmentMode;
}) {
  const spotsLow = listing.ordersLeft > 0 && listing.ordersLeft <= 5;
  const spotsOut = listing.ordersLeft === 0;
  const schedule = scheduleLine(listing, fulfillment);

  return (
    <Link href={`/app/listings/${listing.id}`} className={styles.card}>
      <div className={styles.cardCover}>
        {listing.deal && (
          <span className={styles.dealBadge}>{listing.deal.badge}</span>
        )}
        <Image
          src={listing.image}
          alt={listing.title}
          fill
          className={styles.cardImage}
          sizes="(max-width: 500px) 100vw, (max-width: 760px) 50vw, (max-width: 1100px) 33vw, 25vw"
        />
        {canSave && (
          <button
            type="button"
            className={`${styles.heartBtn} ${isSaved ? styles.heartBtnActive : ""}`}
            onClick={(e) => onSave(listing.id, e)}
            aria-label={isSaved ? "Remove from saved" : "Save"}
          >
            <Heart
              size={16}
              strokeWidth={2}
              fill={isSaved ? "currentColor" : "none"}
            />
          </button>
        )}
        {spotsOut ? (
          <span className={`${styles.stockPill} ${styles.stockOut}`}>
            Sold out
          </span>
        ) : spotsLow ? (
          <span className={`${styles.stockPill} ${styles.stockLow}`}>
            {listing.ordersLeft} left
          </span>
        ) : null}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.titleRow}>
          <h3 className={styles.cardTitle}>{listing.title}</h3>
          <span className={styles.rating}>
            <Star size={12} fill="currentColor" className={styles.star} />
            <span className={styles.ratingValue}>{cook.rating.toFixed(1)}</span>
          </span>
        </div>

        <p className={styles.metaLine}>
          {cook.displayName.split(" ")[0]} · {formatDist(listing.distanceKm)} ·{" "}
          <span className={styles.metaPrice}>From ${listing.priceFrom}</span>
          {listing.subscriptionEnabled && (
            <span className={styles.subHint}>
              <RefreshCw size={10} />
              Subscribe
            </span>
          )}
        </p>

        <p className={styles.scheduleLine}>
          <span
            className={
              schedule.urgency !== "normal"
                ? styles.scheduleUrgent
                : styles.scheduleMuted
            }
          >
            {schedule.orderBy}
          </span>
          <span className={styles.scheduleSep}> · </span>
          <span className={styles.scheduleMuted}>{schedule.receiveOn}</span>
        </p>
      </div>
    </Link>
  );
}

// ─── Row Section ──────────────────────────────────────────────────────────────

const GAP = 24;

function RowSection({
  title,
  subtitle,
  listings,
  saved,
  onSave,
  canSave,
  fulfillment,
}: {
  title: string;
  subtitle?: string;
  listings: MockListing[];
  saved: Set<string>;
  onSave: (id: string, e: React.MouseEvent) => void;
  canSave: boolean;
  fulfillment: FulfillmentMode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
      setPage(0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (listings.length === 0) return null;

  const perPage =
    width >= 1400
      ? 5
      : width >= 1100
        ? 4
        : width >= 760
          ? 3
          : width >= 500
            ? 2
            : 1;
  const cardWidth = width > 0 ? (width - (perPage - 1) * GAP) / perPage : 300;
  const totalPages = Math.ceil(listings.length / perPage);
  const atStart = page === 0;
  const atEnd = page >= totalPages - 1;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionHeadText}>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {subtitle && <p className={styles.sectionSub}>{subtitle}</p>}
        </div>
        {totalPages > 1 && (
          <div className={styles.arrows}>
            <button
              type="button"
              className={`${styles.arrow} ${atStart ? styles.arrowOff : ""}`}
              onClick={() => setPage((p) => p - 1)}
              disabled={atStart}
              aria-label="Previous"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className={`${styles.arrow} ${atEnd ? styles.arrowOff : ""}`}
              onClick={() => setPage((p) => p + 1)}
              disabled={atEnd}
              aria-label="Next"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
      <div ref={outerRef} className={styles.carouselOuter}>
        <div
          className={styles.carouselTrack}
          style={{ transform: `translateX(-${page * (width + GAP)}px)` }}
        >
          {listings.map((l) => (
            <div
              key={l.id}
              style={{ flex: `0 0 ${cardWidth}px`, maxWidth: `${cardWidth}px` }}
            >
              <ListingCard
                listing={l}
                cook={cookFor(l)}
                isSaved={saved.has(l.id)}
                onSave={onSave}
                canSave={canSave}
                fulfillment={fulfillment}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Cook Spotlight ───────────────────────────────────────────────────────────

function CookSpotlightSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionHeadText}>
          <h2 className={styles.sectionTitle}>Weekly cooks spotlight</h2>
          <p className={styles.sectionSub}>
            The home chefs your neighbours are loving
          </p>
        </div>
      </div>
      <div className={styles.strip}>
        {MOCK_COOKS.map((cook) => (
          <Link
            key={cook.id}
            href={`/app/cooks/${cook.id}`}
            className={styles.cookCard}
          >
            <div
              className={styles.cookAvatarLg}
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
            <span className={styles.cookCardRating}>
              <Star size={11} fill="currentColor" />
              {cook.rating.toFixed(1)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrowsePage() {
  const { fulfillment, isLoggedIn } = useApp();
  const [saved, setSaved] = useState<Set<string>>(new Set());

  function toggleSave(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaved((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const filtered = useMemo(
    () => applyFilters(MOCK_LISTINGS, fulfillment),
    [fulfillment],
  );

  const spotlight = useMemo(
    () => filtered.filter((l) => l.isSpotlight),
    [filtered],
  );
  const deals = useMemo(
    () => filtered.filter((l) => l.deal !== null),
    [filtered],
  );
  const newListings = useMemo(
    () => filtered.filter((l) => l.isNew),
    [filtered],
  );
  const fastest = useMemo(
    () => [...filtered].sort((a, b) => a.distanceKm - b.distanceKm),
    [filtered],
  );
  const highProtein = useMemo(
    () => filtered.filter((l) => l.niches.includes("high_protein")),
    [filtered],
  );
  const halal = useMemo(
    () =>
      filtered.filter(
        (l) =>
          l.dishes.length > 0 &&
          l.dishes.every((d) => d.badges.includes("halal")),
      ),
    [filtered],
  );

  return (
    <div className={styles.page}>
      {/* Sticky bar: fulfillment toggle + cuisine chips */}
      <div className={styles.filterBar}>
        <div className={styles.filterInner}>
          <div className={styles.mobileToggle}>
            <FulfillmentToggle />
          </div>
          <div className={styles.chipScroller}>
            {CUISINE_OPTIONS.map(({ label, value }) => (
              <Link
                key={value}
                href={
                  value === "all"
                    ? "/app/search"
                    : `/app/search?cuisine=${encodeURIComponent(value)}`
                }
                className={styles.chip}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No listings available</p>
            <p className={styles.emptyDesc}>Try switching to Delivery.</p>
          </div>
        ) : (
          <>
            <RowSection
              title="Spotlight"
              subtitle="Hand-picked feasts from top cooks near you"
              listings={spotlight}
              saved={saved}
              onSave={toggleSave}
              canSave={isLoggedIn}
              fulfillment={fulfillment}
            />
            <RowSection
              title="Hot deals"
              subtitle="Limited-time offers worth grabbing"
              listings={deals}
              saved={saved}
              onSave={toggleSave}
              canSave={isLoggedIn}
              fulfillment={fulfillment}
            />
            <RowSection
              title="New on 7eats"
              subtitle="Fresh menus just added"
              listings={newListings}
              saved={saved}
              onSave={toggleSave}
              canSave={isLoggedIn}
              fulfillment={fulfillment}
            />
            <RowSection
              title="Fastest near you"
              subtitle="The shortest trip to a home-cooked meal"
              listings={fastest}
              saved={saved}
              onSave={toggleSave}
              canSave={isLoggedIn}
              fulfillment={fulfillment}
            />
            <CookSpotlightSection />
            <RowSection
              title="High protein"
              subtitle="Meals built around serious protein"
              listings={highProtein}
              saved={saved}
              onSave={toggleSave}
              canSave={isLoggedIn}
              fulfillment={fulfillment}
            />
            <RowSection
              title="Halal picks"
              subtitle="Certified halal kitchens"
              listings={halal}
              saved={saved}
              onSave={toggleSave}
              canSave={isLoggedIn}
              fulfillment={fulfillment}
            />
          </>
        )}
      </div>
    </div>
  );
}
