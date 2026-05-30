"use client";

import { Package, Plus, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { MOCK_DISHES, MOCK_LISTINGS } from "./_mock";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "listings" | "dishes";
type Filter = "active" | "draft" | "archived";

// ─── Status pill (on card image) ──────────────────────────────────────────────

function ImgPill({ status }: { status: "active" | "draft" | "archived" }) {
  const dotCls =
    status === "active"
      ? styles.dotActive
      : status === "draft"
        ? styles.dotDraft
        : styles.dotArchived;
  const label =
    status === "active" ? "Active" : status === "draft" ? "Draft" : "Archived";
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
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  actionLabel: string;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>{icon}</div>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyDesc}>{desc}</p>
      <button type="button" className={styles.emptyBtn}>
        <Plus size={13} />
        {actionLabel}
      </button>
    </div>
  );
}

// ─── Listings tab ─────────────────────────────────────────────────────────────

function ListingsContent({ filter }: { filter: Filter }) {
  const items = MOCK_LISTINGS.filter((l) => l.status === filter);

  if (MOCK_LISTINGS.length === 0) {
    return (
      <EmptyState
        icon={<Store size={18} />}
        title="No listings yet"
        desc="Bundle your dishes into packages clients can browse and order."
        actionLabel="New Listing"
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
                <span className={styles.statNum}>{listing.dishCount}</span>{" "}
                {listing.dishCount === 1 ? "dish" : "dishes"}
              </span>
              <span className={styles.statSep}>·</span>
              <span>
                <span className={styles.statNum}>{listing.orderCount}</span>{" "}
                {listing.orderCount === 1 ? "order" : "orders"}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Dishes tab ───────────────────────────────────────────────────────────────

function DishesContent({ filter }: { filter: Filter }) {
  const items = MOCK_DISHES.filter((d) => d.status === filter);

  if (MOCK_DISHES.length === 0) {
    return (
      <EmptyState
        icon={<Package size={18} />}
        title="No dishes yet"
        desc="Add dishes — the building blocks of every listing."
        actionLabel="New Dish"
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
              className={`${styles.dishFooter} ${dish.listingCount === 0 ? styles.dishFooterMuted : ""}`}
            >
              {dish.listingCount === 0
                ? "Not in any listing yet"
                : `In ${dish.listingCount} listing${dish.listingCount !== 1 ? "s" : ""}`}
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
        <button type="button" className={styles.newBtn}>
          <Plus size={14} />
          {NEW_LABEL[tab]}
        </button>
      </div>

      <div className={styles.content} key={`${tab}-${filter}`}>
        {tab === "listings" && <ListingsContent filter={filter} />}
        {tab === "dishes" && <DishesContent filter={filter} />}
      </div>
    </div>
  );
}
