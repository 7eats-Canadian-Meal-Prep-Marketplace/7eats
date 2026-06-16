"use client";

import { Package, Plus, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "listings" | "dishes";
type Filter = "active" | "draft" | "archived";

type Listing = {
  id: string;
  title: string;
  status: "draft" | "pending_review" | "active" | "archived";
  basePrice: string;
  currency: string;
  dishCount: number;
  orderCount: number;
  minOrderQty: number;
  maxOrderQty: number | null;
};

type Dish = {
  id: string;
  name: string;
  cuisine: string | null;
  categories: string[];
  status: "draft" | "active" | "archived";
  isHalal: boolean;
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isDairyFree: boolean;
  isNutFree: boolean;
  isKosher: boolean;
  listingCount: number;
};

// ─── Status pill (on card image) ──────────────────────────────────────────────

function ImgPill({
  status,
}: {
  status: "active" | "draft" | "archived" | "pending_review";
}) {
  const dotCls =
    status === "active"
      ? styles.dotActive
      : status === "draft"
        ? styles.dotDraft
        : styles.dotArchived;
  const label =
    status === "active"
      ? "Active"
      : status === "draft"
        ? "Draft"
        : status === "pending_review"
          ? "Pending review"
          : "Archived";
  return (
    <span className={styles.imgPill}>
      <span className={`${styles.pillDot} ${dotCls}`} />
      {label}
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  desc,
  actionLabel,
  actionHref,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>{icon}</div>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyDesc}>{desc}</p>
      <Link href={actionHref} className={styles.emptyBtn}>
        <Plus size={13} />
        {actionLabel}
      </Link>
    </div>
  );
}

// ─── Listings tab ─────────────────────────────────────────────────────────────

function ListingsContent({
  listings,
  filter,
  loading,
}: {
  listings: Listing[];
  filter: Filter;
  loading: boolean;
}) {
  const items = listings.filter((l) => {
    if (filter === "archived") return l.status === "archived";
    if (filter === "draft")
      return l.status === "draft" || l.status === "pending_review";
    return l.status === "active";
  });

  if (loading) {
    return <div className={styles.noItems}>Loading…</div>;
  }

  if (listings.length === 0) {
    return (
      <EmptyState
        icon={<Store size={18} />}
        title="No listings yet"
        desc="Bundle your dishes into packages clients can browse and order."
        actionLabel="New Listing"
        actionHref="/business/listings/new"
      />
    );
  }

  if (items.length === 0) {
    return <div className={styles.noItems}>No {filter} listings</div>;
  }

  return (
    <div className={styles.grid}>
      {items.map((listing) => (
        <Link
          key={listing.id}
          href={`/business/listings/${listing.id}`}
          className={styles.card}
        >
          <div className={styles.cardImg}>
            <Image
              src="/placeholder.jpg"
              alt={listing.title}
              fill
              sizes="(max-width: 540px) 100vw, (max-width: 900px) 50vw, 33vw"
              className={styles.cardImgEl}
            />
            <div className={styles.imgScrim} />
            <ImgPill status={listing.status} />
            <div className={styles.priceTag}>
              ${listing.basePrice}
              <span className={styles.priceTagCurr}>{listing.currency}</span>
            </div>
          </div>

          <div className={styles.cardBody}>
            <div className={styles.cardTitle}>{listing.title}</div>
            <div className={styles.cardSub}>
              Min {listing.minOrderQty}
              {listing.maxOrderQty != null
                ? ` · Max ${listing.maxOrderQty}`
                : " · No max"}
            </div>
            <div className={styles.cardDivider} />
            <div className={styles.cardStats}>
              <span>
                <span className={styles.statNum}>
                  {Number(listing.dishCount)}
                </span>{" "}
                {Number(listing.dishCount) === 1 ? "dish" : "dishes"}
              </span>
              <span className={styles.statSep}>·</span>
              <span>
                <span className={styles.statNum}>
                  {Number(listing.orderCount)}
                </span>{" "}
                {Number(listing.orderCount) === 1 ? "order" : "orders"}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Dishes tab ───────────────────────────────────────────────────────────────

function DishesContent({
  dishes,
  filter,
  loading,
}: {
  dishes: Dish[];
  filter: Filter;
  loading: boolean;
}) {
  const items = dishes.filter((d) => d.status === filter);

  if (loading) {
    return <div className={styles.noItems}>Loading…</div>;
  }

  if (dishes.length === 0) {
    return (
      <EmptyState
        icon={<Package size={18} />}
        title="No dishes yet"
        desc="Add dishes — the building blocks of every listing."
        actionLabel="New Dish"
        actionHref="/business/listings/dishes/new"
      />
    );
  }

  if (items.length === 0) {
    return <div className={styles.noItems}>No {filter} dishes</div>;
  }

  return (
    <div className={styles.grid}>
      {items.map((dish) => (
        <Link
          key={dish.id}
          href={`/business/listings/dishes/${dish.id}`}
          className={styles.card}
        >
          <div className={styles.cardImg}>
            <Image
              src="/placeholder.jpg"
              alt={dish.name}
              fill
              sizes="(max-width: 540px) 100vw, (max-width: 900px) 50vw, 33vw"
              className={styles.cardImgEl}
            />
            <div className={styles.imgScrim} />
            <ImgPill status={dish.status} />
            {dish.cuisine && (
              <span className={styles.cuisineTag}>{dish.cuisine}</span>
            )}
          </div>

          <div className={styles.cardBody}>
            <div className={styles.cardTitle}>{dish.name}</div>
            <div className={styles.cardDivider} />
            <div
              className={`${styles.dishFooter} ${Number(dish.listingCount) === 0 ? styles.dishFooterMuted : ""}`}
            >
              {Number(dish.listingCount) === 0
                ? "Not in any listing yet"
                : `In ${Number(dish.listingCount)} listing${Number(dish.listingCount) !== 1 ? "s" : ""}`}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "listings", label: "Listings" },
  { id: "dishes", label: "Dishes" },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "archived", label: "Archived" },
];

const NEW_LABEL: Record<Tab, string> = {
  listings: "New Listing",
  dishes: "New Dish",
};

export default function ListingsPage() {
  const [tab, setTab] = useState<Tab>("listings");
  const [filter, setFilter] = useState<Filter>("active");
  const [listings, setListings] = useState<Listing[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingDishes, setLoadingDishes] = useState(true);

  const loadListings = useCallback(async () => {
    setLoadingListings(true);
    try {
      const res = await fetch("/api/business/listings");
      if (res.ok) {
        const json = await res.json();
        setListings(json.data ?? []);
      }
    } finally {
      setLoadingListings(false);
    }
  }, []);

  const loadDishes = useCallback(async () => {
    setLoadingDishes(true);
    try {
      const res = await fetch("/api/business/listings/dishes");
      if (res.ok) {
        const json = await res.json();
        setDishes(json.data ?? []);
      }
    } finally {
      setLoadingDishes(false);
    }
  }, []);

  useEffect(() => {
    loadListings();
    loadDishes();
  }, [loadListings, loadDishes]);

  return (
    <div className={styles.page}>
      <div className={styles.tabRow}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`${styles.filterBtn} ${filter === f.id ? styles.filterBtnActive : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Link
          href={
            tab === "listings"
              ? "/business/listings/new"
              : "/business/listings/dishes/new"
          }
          className={styles.newBtn}
        >
          <Plus size={14} />
          {NEW_LABEL[tab]}
        </Link>
      </div>

      <div className={styles.content} key={`${tab}-${filter}`}>
        {tab === "listings" && (
          <ListingsContent
            listings={listings}
            filter={filter}
            loading={loadingListings}
          />
        )}
        {tab === "dishes" && (
          <DishesContent
            dishes={dishes}
            filter={filter}
            loading={loadingDishes}
          />
        )}
      </div>
    </div>
  );
}
