"use client";

import {
  Check,
  ChevronDown,
  Heart,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useApp } from "../_app-context";
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

type FiltersState = {
  orderType: "all" | "one_time" | "subscription";
};

type SortOption = "relevance" | "price_asc" | "price_desc";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: FiltersState = {
  orderType: "all",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number | null): string {
  if (price == null) return "";
  return `From $${price}`;
}

function cookDisplayName(listing: ListingCard): string {
  return listing.cookFirstName ?? listing.cookName ?? "Chef";
}

function applyClientFilters(
  listings: ListingCard[],
  f: FiltersState,
): ListingCard[] {
  return listings.filter((l) => {
    if (f.orderType !== "all" && l.type !== f.orderType) return false;
    return true;
  });
}

function activeFilterCount(f: FiltersState): number {
  let n = 0;
  if (f.orderType !== "all") n++;
  return n;
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

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Best match", value: "relevance" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
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
  allListings,
}: {
  filters: FiltersState;
  onChange: (f: FiltersState) => void;
  onClose: () => void;
  allListings: ListingCard[];
}) {
  const [draft, setDraft] = useState<FiltersState>({ ...filters });

  const draftCount = useMemo(
    () => applyClientFilters(allListings, draft).length,
    [draft, allListings],
  );

  function set(patch: Partial<FiltersState>) {
    setDraft((p) => ({ ...p, ...patch }));
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
            <span className={styles.filterGroupLabel}>Order type</span>
            <div className={styles.filterOpts}>
              {opt("all", draft.orderType, "All", () =>
                set({ orderType: "all" }),
              )}
              {opt("one_time", draft.orderType, "Single order", () =>
                set({ orderType: "one_time" }),
              )}
              {opt("subscription", draft.orderType, "Subscription", () =>
                set({ orderType: "subscription" }),
              )}
            </div>
          </div>
        </div>
        <div className={styles.panelFoot}>
          <button
            type="button"
            className={styles.panelClearBtn}
            onClick={() => setDraft({ ...DEFAULT_FILTERS })}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

function SearchPageContent() {
  const searchParams = useSearchParams();
  const { isLoggedIn } = useApp();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<FiltersState>(() => ({
    ...DEFAULT_FILTERS,
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [allListings, setAllListings] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortOption>("relevance");

  // Sync query from URL params
  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Fetch from API whenever query changes (debounced)
  const fetchListings = useCallback((q: string) => {
    setLoading(true);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const url = q
      ? `${baseUrl}/api/listings?q=${encodeURIComponent(q)}`
      : `${baseUrl}/api/listings`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        setAllListings(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => setAllListings([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchListings(query), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, fetchListings]);

  function toggleSave(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaved((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const results = useMemo(
    () => applyClientFilters(allListings, filters),
    [allListings, filters],
  );

  const sorted = useMemo(() => {
    const arr = [...results];
    if (sort === "price_asc")
      arr.sort((a, b) => (a.priceFrom ?? 0) - (b.priceFrom ?? 0));
    else if (sort === "price_desc")
      arr.sort((a, b) => (b.priceFrom ?? 0) - (a.priceFrom ?? 0));
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
              <Link
                key={value}
                href={
                  value === "all"
                    ? "/app/search"
                    : `/app/search?q=${encodeURIComponent(value)}`
                }
                className={`${styles.chip} ${
                  (value === "all" && !query) ||
                  query.toLowerCase() === value.toLowerCase()
                    ? styles.chipActive
                    : ""
                }`}
              >
                {label}
              </Link>
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
            {loading
              ? "Searching…"
              : results.length === 0
                ? "Nothing found"
                : `${results.length} found`}
            {!loading && query ? ` for "${query}"` : ""}
          </p>
          {results.length > 0 && (
            <SortDropdown value={sort} onChange={setSort} />
          )}
        </div>

        {!loading && sorted.length === 0 ? (
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
              <ListingCardItem
                key={l.id}
                listing={l}
                isSaved={saved.has(l.id)}
                onSave={toggleSave}
                canSave={isLoggedIn}
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
          allListings={allListings}
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
