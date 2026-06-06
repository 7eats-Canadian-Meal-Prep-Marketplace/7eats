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
import { MOCK_COOKS } from "../_mock";
import { FulfillmentToggle } from "../_shell";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type ListingCard = {
  id: string;
  title: string;
  description: string | null;
  cookId: string;
  cookName: string | null;
  cookFirstName: string | null;
  priceFrom: number | null;
  type: string;
  subscriptionEnabled: boolean;
  coverPhotoUrl: string | null;
  minOrderQty: number | null;
  maxOrderQty: number | null;
  createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number | null): string {
  if (price == null) return "";
  return `From $${price}`;
}

function cookDisplayName(listing: ListingCard): string {
  return listing.cookFirstName ?? listing.cookName ?? "Chef";
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

function ListingCardItem({
  listing,
  isSaved,
  onSave,
  canSave,
}: {
  listing: ListingCard;
  isSaved: boolean;
  onSave: (id: string, e: React.MouseEvent) => void;
  canSave: boolean;
}) {
  return (
    <Link href={`/app/listings/${listing.id}`} className={styles.card}>
      <div className={styles.cardCover}>
        <Image
          src={listing.coverPhotoUrl ?? "/placeholder.jpg"}
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
      </div>

      <div className={styles.cardBody}>
        <div className={styles.titleRow}>
          <h3 className={styles.cardTitle}>{listing.title}</h3>
        </div>

        <p className={styles.metaLine}>
          {cookDisplayName(listing)}
          {listing.priceFrom != null && (
            <>
              {" "}
              ·{" "}
              <span className={styles.metaPrice}>
                {formatPrice(listing.priceFrom)}
              </span>
            </>
          )}
          {listing.subscriptionEnabled && (
            <span className={styles.subHint}>
              <RefreshCw size={10} />
              Subscribe
            </span>
          )}
        </p>

        <p className={styles.scheduleLine}>
          <span className={styles.scheduleMuted}>
            {listing.type === "subscription" ? "Subscription" : "Single order"}
          </span>
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
}: {
  title: string;
  subtitle?: string;
  listings: ListingCard[];
  saved: Set<string>;
  onSave: (id: string, e: React.MouseEvent) => void;
  canSave: boolean;
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
              <ListingCardItem
                listing={l}
                isSaved={saved.has(l.id)}
                onSave={onSave}
                canSave={canSave}
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
  const { isLoggedIn } = useApp();
  const [listings, setListings] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    fetch(`${baseUrl}/api/listings`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        setListings(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

  // Load saved listing IDs for logged-in users (silently ignore auth errors)
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/favourites/listings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setSaved(new Set((json.data ?? []).map((s: { id: string }) => s.id)));
        }
      })
      .catch(() => {}); // Not logged in or network error — ignore
  }, [isLoggedIn]);

  async function toggleSave(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const isSaved = saved.has(id);
    // Optimistic update
    setSaved((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(id) : next.add(id);
      return next;
    });
    try {
      if (isSaved) {
        await fetch(`/api/favourites/listings/${id}`, { method: "DELETE" });
      } else {
        await fetch("/api/favourites/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: id }),
        });
      }
    } catch {
      // Revert optimistic update on failure
      setSaved((prev) => {
        const next = new Set(prev);
        isSaved ? next.add(id) : next.delete(id);
        return next;
      });
    }
  }

  const subscriptionListings = useMemo(
    () => listings.filter((l) => l.subscriptionEnabled),
    [listings],
  );

  const recentListings = useMemo(
    () =>
      [...listings]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 10),
    [listings],
  );

  const singleOrderListings = useMemo(
    () => listings.filter((l) => l.type === "one_time"),
    [listings],
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
        {loading ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Loading listings…</p>
          </div>
        ) : listings.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No listings available</p>
            <p className={styles.emptyDesc}>Check back soon.</p>
          </div>
        ) : (
          <>
            <RowSection
              title="All listings"
              subtitle="Home-cooked meals near you"
              listings={listings}
              saved={saved}
              onSave={toggleSave}
              canSave={isLoggedIn}
            />
            <RowSection
              title="Subscribe & save"
              subtitle="Weekly meal subscriptions from home cooks"
              listings={subscriptionListings}
              saved={saved}
              onSave={toggleSave}
              canSave={isLoggedIn}
            />
            <RowSection
              title="Single orders"
              subtitle="One-time meals, no commitment"
              listings={singleOrderListings}
              saved={saved}
              onSave={toggleSave}
              canSave={isLoggedIn}
            />
            <CookSpotlightSection />
            <RowSection
              title="Recently added"
              subtitle="Fresh menus just posted"
              listings={recentListings}
              saved={saved}
              onSave={toggleSave}
              canSave={isLoggedIn}
            />
          </>
        )}
      </div>
    </div>
  );
}
