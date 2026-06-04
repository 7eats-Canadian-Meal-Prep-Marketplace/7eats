"use client";

import {
  Check,
  ChevronDown,
  Heart,
  RefreshCw,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../_app-context";
import { type FulfillmentMode, scheduleLine } from "../_listing-card-utils";
import {
  type CuisineType,
  type DietaryBadge,
  MOCK_COOKS,
  MOCK_LISTINGS,
  type MockCook,
  type MockListing,
  type NicheCategory,
} from "../_mock";
import { FulfillmentToggle } from "../_shell";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type FiltersState = {
  cuisine: CuisineType | "all";
  dietary: Set<DietaryBadge>;
  niche: Set<NicheCategory>;
  orderType: "all" | "one-time" | "subscription";
  distanceKm: number; // 1–25; 25 = no limit
};

// FulfillmentMode imported from _listing-card-utils

const DEFAULT_FILTERS: FiltersState = {
  cuisine: "all",
  dietary: new Set(),
  niche: new Set(),
  orderType: "all",
  distanceKm: 25,
};

type SortOption = "relevance" | "price_asc" | "price_desc" | "rating_desc";

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

function matchesQuery(l: MockListing, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  const cook = cookFor(l);
  return (
    l.title.toLowerCase().includes(s) ||
    l.description.toLowerCase().includes(s) ||
    cook.displayName.toLowerCase().includes(s) ||
    l.cuisineTypes.some((c) => c.toLowerCase().includes(s)) ||
    l.dishes.some((d) => d.name.toLowerCase().includes(s))
  );
}

function applyFilters(
  listings: MockListing[],
  mode: FulfillmentMode,
  f: FiltersState,
  q: string,
): MockListing[] {
  return listings.filter((l) => {
    if (l.fulfillment !== mode && l.fulfillment !== "both") return false;
    if (hoursUntil(l.orderDeadlineIso) <= 0) return false;
    if (!matchesQuery(l, q)) return false;
    if (f.cuisine !== "all" && !l.cuisineTypes.includes(f.cuisine))
      return false;
    if (f.dietary.size > 0) {
      const ok =
        l.dishes.length > 0 &&
        l.dishes.every((d) =>
          [...f.dietary].every((b) => d.badges.includes(b)),
        );
      if (!ok) return false;
    }
    if (f.niche.size > 0) {
      if (![...f.niche].every((n) => l.niches.includes(n))) return false;
    }
    if (f.orderType !== "all" && l.orderType !== f.orderType) return false;
    if (f.distanceKm < 25 && l.distanceKm > f.distanceKm) return false;
    return true;
  });
}

function activeFilterCount(f: FiltersState): number {
  let n = 0;
  if (f.cuisine !== "all") n++;
  n += f.dietary.size;
  n += f.niche.size;
  if (f.orderType !== "all") n++;
  if (f.distanceKm < 25) n++;
  return n;
}

// ─── Options ──────────────────────────────────────────────────────────────────

const CUISINE_OPTIONS: { label: string; value: CuisineType | "all" }[] = [
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

const DIETARY_OPTIONS: { label: string; value: DietaryBadge }[] = [
  { label: "Halal", value: "halal" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Vegan", value: "vegan" },
  { label: "Gluten-free", value: "gluten-free" },
  { label: "Dairy-free", value: "dairy-free" },
  { label: "Nut-free", value: "nut-free" },
  { label: "Kosher", value: "kosher" },
];

const NICHE_OPTIONS: { label: string; value: NicheCategory }[] = [
  { label: "High protein", value: "high_protein" },
  { label: "Muscle gain", value: "muscle_gain" },
  { label: "Low carb", value: "low_carb" },
  { label: "Heart health", value: "heart_health" },
  { label: "Weight loss", value: "weight_loss" },
  { label: "Balanced", value: "balanced" },
  { label: "Comfort food", value: "comfort_food" },
  { label: "Kids friendly", value: "kids_friendly" },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Best match", value: "relevance" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Top Rated", value: "rating_desc" },
];

// ─── Sort Dropdown ────────────────────────────────────────────────────────────

function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (v: SortOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const current =
    SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  return (
    <div className={styles.sortWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.sortTrigger} ${open ? styles.sortTriggerOpen : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {current.label}
        <ChevronDown size={15} className={styles.sortChevron} />
      </button>
      {open && (
        <div className={styles.sortMenu} role="listbox">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={value === opt.value}
              className={`${styles.sortOption} ${value === opt.value ? styles.sortOptionActive : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
              {value === opt.value && <Check size={16} strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filters Panel ────────────────────────────────────────────────────────────

function FiltersPanel({
  filters,
  onChange,
  onClose,
  fulfillment,
  query,
}: {
  filters: FiltersState;
  onChange: (f: FiltersState) => void;
  onClose: () => void;
  fulfillment: FulfillmentMode;
  query: string;
}) {
  const [draft, setDraft] = useState<FiltersState>({
    ...filters,
    dietary: new Set(filters.dietary),
    niche: new Set(filters.niche),
  });

  const draftCount = useMemo(
    () => applyFilters(MOCK_LISTINGS, fulfillment, draft, query).length,
    [draft, fulfillment, query],
  );

  function set(patch: Partial<FiltersState>) {
    setDraft((p) => ({ ...p, ...patch }));
  }

  function toggle<T>(key: "dietary" | "niche", val: T) {
    setDraft((p) => {
      const next = new Set(p[key] as Set<T>);
      next.has(val) ? next.delete(val) : next.add(val);
      return { ...p, [key]: next };
    });
  }

  function opt<T>(val: T, current: T, label: string, onSelect: () => void) {
    return (
      <button
        key={String(val)}
        type="button"
        className={`${styles.filterOpt} ${current === val ? styles.filterOptActive : ""}`}
        onClick={onSelect}
      >
        {label}
      </button>
    );
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop dismiss
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop dismiss
    <div className={styles.backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <span className={styles.modalTitle}>Filters</span>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel}>
              Dietary restrictions
            </span>
            <div className={styles.filterOpts}>
              {DIETARY_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.filterOpt} ${draft.dietary.has(value) ? styles.filterOptActive : ""}`}
                  onClick={() => toggle("dietary", value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel}>Niche</span>
            <div className={styles.filterOpts}>
              {NICHE_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.filterOpt} ${draft.niche.has(value) ? styles.filterOptActive : ""}`}
                  onClick={() => toggle("niche", value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel}>Order type</span>
            <div className={styles.filterOpts}>
              {opt("all", draft.orderType, "All", () =>
                set({ orderType: "all" }),
              )}
              {opt("one-time", draft.orderType, "Single order", () =>
                set({ orderType: "one-time" }),
              )}
              {opt("subscription", draft.orderType, "Subscription", () =>
                set({ orderType: "subscription" }),
              )}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <div className={styles.sliderLabelRow}>
              <span className={styles.filterGroupLabel}>Max distance</span>
              <span className={styles.sliderValue}>
                {draft.distanceKm >= 25 ? "Any" : `${draft.distanceKm} km`}
              </span>
            </div>
            <input
              type="range"
              className={styles.slider}
              min={1}
              max={25}
              step={1}
              value={draft.distanceKm}
              onChange={(e) => set({ distanceKm: Number(e.target.value) })}
            />
            <div className={styles.sliderTicks}>
              <span>1 km</span>
              <span>Any</span>
            </div>
          </div>
        </div>
        <div className={styles.panelFoot}>
          <button
            type="button"
            className={styles.panelClearBtn}
            onClick={() =>
              setDraft({
                ...DEFAULT_FILTERS,
                dietary: new Set(),
                niche: new Set(),
              })
            }
          >
            Clear
          </button>
          <button
            type="button"
            className={styles.applyBtn}
            disabled={draftCount === 0}
            onClick={() => {
              onChange(draft);
              onClose();
            }}
          >
            {draftCount === 0
              ? "No results found"
              : `Apply (${draftCount} found)`}
          </button>
        </div>
      </div>
    </div>
  );
}

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
          sizes="(max-width: 560px) 100vw, (max-width: 860px) 50vw, (max-width: 1140px) 33vw, 25vw"
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

// ─── Page ─────────────────────────────────────────────────────────────────────

function SearchPageContent() {
  const searchParams = useSearchParams();
  const { fulfillment, isLoggedIn } = useApp();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<FiltersState>(() => {
    const c = searchParams.get("cuisine") as CuisineType | null;
    return {
      ...DEFAULT_FILTERS,
      dietary: new Set(),
      niche: new Set(),
      ...(c ? { cuisine: c } : {}),
    };
  });
  const [showFilters, setShowFilters] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    const c = searchParams.get("cuisine") as CuisineType | null;
    setFilters((f) => ({ ...f, cuisine: c ?? "all" }));
  }, [searchParams]);

  function toggleSave(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaved((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const [sort, setSort] = useState<SortOption>("relevance");

  const results = useMemo(
    () => applyFilters(MOCK_LISTINGS, fulfillment, filters, query),
    [fulfillment, filters, query],
  );

  const sorted = useMemo(() => {
    const arr = [...results];
    if (sort === "price_asc") arr.sort((a, b) => a.priceFrom - b.priceFrom);
    else if (sort === "price_desc")
      arr.sort((a, b) => b.priceFrom - a.priceFrom);
    else if (sort === "rating_desc")
      arr.sort((a, b) => cookFor(b).rating - cookFor(a).rating);
    return arr;
  }, [results, sort]);

  const filterCount = activeFilterCount(filters);

  return (
    <div className={styles.page}>
      {/* Sticky bar: fulfillment toggle + cuisine chips + filters button */}
      <div className={styles.filterBar}>
        <div className={styles.filterInner}>
          <div className={styles.mobileToggle}>
            <FulfillmentToggle />
          </div>
          <div className={styles.chipScroller}>
            {CUISINE_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className={`${styles.chip} ${filters.cuisine === value ? styles.chipActive : ""}`}
                onClick={() => setFilters((f) => ({ ...f, cuisine: value }))}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${styles.filtersBtn} ${filterCount > 0 ? styles.filtersBtnActive : ""}`}
            onClick={() => setShowFilters(true)}
          >
            <SlidersHorizontal size={14} />
            Filters
            {filterCount > 0 && (
              <span className={styles.filterBadge}>{filterCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className={styles.content}>
        <div className={styles.resultsBar}>
          <p className={styles.resultCount}>
            {results.length === 0 ? "Nothing found" : `${results.length} found`}
            {query ? ` for "${query}"` : ""}
          </p>
          {results.length > 0 && (
            <SortDropdown value={sort} onChange={setSort} />
          )}
        </div>

        {sorted.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Nothing matched</p>
            <p className={styles.emptyDesc}>
              Try a different search or clear your filters.
            </p>
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setQuery("");
                setFilters(DEFAULT_FILTERS);
              }}
            >
              Clear
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {sorted.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                cook={cookFor(l)}
                isSaved={saved.has(l.id)}
                onSave={toggleSave}
                canSave={isLoggedIn}
                fulfillment={fulfillment}
              />
            ))}
          </div>
        )}
      </div>

      {showFilters && (
        <FiltersPanel
          filters={filters}
          onChange={setFilters}
          onClose={() => setShowFilters(false)}
          fulfillment={fulfillment}
          query={query}
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageContent />
    </Suspense>
  );
}
