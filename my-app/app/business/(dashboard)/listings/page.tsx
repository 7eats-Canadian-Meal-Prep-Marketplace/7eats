"use client";

import { Package, Plus, Store, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { MOCK_DEALS, MOCK_DISHES, MOCK_LISTINGS, type MockDeal } from "./_mock";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "listings" | "dishes" | "deals";
type Filter = "active" | "draft" | "archived";
type DealFilter = "current" | "past";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDeal(deal: MockDeal): string {
  if (deal.type === "percentage_off") return `${deal.value}% off`;
  if (deal.type === "fixed_off") return `$${deal.value} off`;
  return `Buy ${deal.buyQty}, get ${deal.getQty} free`;
}

function formatValidity(deal: MockDeal): string {
  if (!deal.validUntil) return "No expiry";
  const d = new Date(deal.validUntil);
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

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
          {/* Placeholder image */}
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

          {/* Body */}
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
          {/* Placeholder image */}
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

          {/* Body */}
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

// ─── Deals tab ────────────────────────────────────────────────────────────────

function DealsContent({ filter }: { filter: DealFilter }) {
  const now = new Date();
  const items = MOCK_DEALS.filter((d) => {
    const expired = d.validUntil !== null && new Date(d.validUntil) <= now;
    const isCurrent = d.isActive && !expired;
    return filter === "current" ? isCurrent : !isCurrent;
  });

  if (MOCK_DEALS.length === 0) {
    return (
      <EmptyState
        icon={<Tag size={18} />}
        title="No promotions yet"
        desc="Create deals to attract more orders — discounts, fixed offers, or buy-one-get-one."
        actionLabel="New Deal"
      />
    );
  }

  if (items.length === 0) {
    return <div className={styles.noItems}>No {filter} deals</div>;
  }

  return (
    <div className={styles.list}>
      {items.map((deal) => (
        <div key={deal.id} className={styles.dealRow}>
          <span className={styles.dealAmount}>{formatDeal(deal)}</span>
          <span className={styles.dealDetails}>
            {deal.listingTitle}
            {" · "}
            {formatValidity(deal)}
            {" · "}
            {deal.usesCount}
            {deal.maxUses != null ? `/${deal.maxUses}` : ""} uses
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "listings", label: "Listings" },
  { id: "dishes", label: "Dishes" },
  { id: "deals", label: "Deals" },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "archived", label: "Archived" },
];

const DEAL_FILTERS: { id: DealFilter; label: string }[] = [
  { id: "current", label: "Current" },
  { id: "past", label: "Past" },
];

const NEW_LABEL: Record<Tab, string> = {
  listings: "New Listing",
  dishes: "New Dish",
  deals: "New Deal",
};

export default function ListingsPage() {
  const [tab, setTab] = useState<Tab>("listings");
  const [filter, setFilter] = useState<Filter>("active");
  const [dealFilter, setDealFilter] = useState<DealFilter>("current");

  const isDeals = tab === "deals";

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
          {isDeals
            ? DEAL_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDealFilter(f.id)}
                  className={`${styles.filterBtn} ${dealFilter === f.id ? styles.filterBtnActive : ""}`}
                >
                  {f.label}
                </button>
              ))
            : FILTERS.map((f) => (
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

      <div
        className={styles.content}
        key={isDeals ? `deals-${dealFilter}` : `${tab}-${filter}`}
      >
        {tab === "listings" && <ListingsContent filter={filter} />}
        {tab === "dishes" && <DishesContent filter={filter} />}
        {tab === "deals" && <DealsContent filter={dealFilter} />}
      </div>
    </div>
  );
}
