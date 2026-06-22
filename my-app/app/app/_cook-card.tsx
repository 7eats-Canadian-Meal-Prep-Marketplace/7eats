"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { cookCardSchedule } from "@/lib/cook-card-schedule";
import { kitchenDisplayName } from "@/lib/cook-display";
import styles from "./browse/page.module.css";

export type BrowseCookCard = {
  id: string;
  displayName: string | null;
  cookName: string | null;
  photoUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  tags: { slug: string; label: string }[];
  niches: { slug: string; label: string }[];
  cuisines: { slug: string; label: string }[];
  leadTime: string | null;
  delivery: "none" | "self" | null;
  offersPickup: boolean;
  pickupCity: string | null;
  rating: number | null;
  reviewCount: number;
  ordersCompleted: number;
  priceFrom: number | null;
  representativeDishPhoto: string | null;
  distanceKm: number | null;
  pickupWindows: {
    dayOfWeek: string;
    fromTime: string;
    toTime: string;
  }[];
  deliveryWindows: {
    dayOfWeek: string;
    fromTime: string;
    toTime: string;
  }[];
};

export function normalizeBrowseCook(
  raw: Record<string, unknown>,
): BrowseCookCard {
  const tags = Array.isArray(raw.tags)
    ? (raw.tags as BrowseCookCard["tags"])
    : [];
  return {
    id: String(raw.id),
    displayName: (raw.displayName as string | null) ?? null,
    cookName: (raw.cookName as string | null) ?? null,
    photoUrl: (raw.photoUrl as string | null) ?? null,
    bannerUrl: (raw.bannerUrl as string | null) ?? null,
    bio: (raw.bio as string | null) ?? null,
    tags,
    niches: Array.isArray(raw.niches)
      ? (raw.niches as BrowseCookCard["niches"])
      : [],
    cuisines: Array.isArray(raw.cuisines)
      ? (raw.cuisines as BrowseCookCard["cuisines"])
      : [],
    leadTime: (raw.leadTime as string | null) ?? null,
    delivery: (raw.delivery as BrowseCookCard["delivery"]) ?? null,
    offersPickup: raw.offersPickup !== false,
    pickupCity: (raw.pickupCity as string | null) ?? null,
    rating: (raw.rating as number | null) ?? null,
    reviewCount: Number(raw.reviewCount ?? 0),
    ordersCompleted: Number(raw.ordersCompleted ?? 0),
    priceFrom: (raw.priceFrom as number | null) ?? null,
    representativeDishPhoto:
      (raw.representativeDishPhoto as string | null) ?? null,
    distanceKm: (raw.distanceKm as number | null) ?? null,
    pickupWindows: Array.isArray(raw.pickupWindows)
      ? (raw.pickupWindows as BrowseCookCard["pickupWindows"])
      : [],
    deliveryWindows: Array.isArray(raw.deliveryWindows)
      ? (raw.deliveryWindows as BrowseCookCard["deliveryWindows"])
      : [],
  };
}

function initials(name: string | null): string {
  if (!name) return "C";
  return name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function CookCardRating({
  rating,
  reviewCount,
}: {
  rating: number | null;
  reviewCount: number;
}) {
  if (rating != null && reviewCount > 0) {
    return (
      <span className={styles.rating}>
        <Star
          size={12}
          className={styles.star}
          fill="currentColor"
          aria-hidden
        />
        <span className={styles.ratingValue}>{rating}</span>
        <span className={styles.ratingCount}>({reviewCount})</span>
      </span>
    );
  }
  return <span className={styles.newBadge}>New</span>;
}

function effectiveFulfillmentMode(
  mode: "pickup" | "delivery",
  cook: BrowseCookCard,
): "pickup" | "delivery" {
  const canDeliver = cook.delivery === "self";
  const canPickup = cook.offersPickup !== false;
  if (mode === "delivery" && canDeliver) return "delivery";
  if (mode === "pickup" && canPickup) return "pickup";
  if (canPickup) return "pickup";
  if (canDeliver) return "delivery";
  return mode;
}

export function CookCardLink({
  cook,
  fulfillmentMode,
}: {
  cook: BrowseCookCard;
  fulfillmentMode: "pickup" | "delivery";
}) {
  const mode = effectiveFulfillmentMode(fulfillmentMode, cook);
  const schedule = cookCardSchedule(
    mode,
    cook.pickupWindows,
    cook.deliveryWindows,
    cook.leadTime,
  );

  const locationParts: string[] = [];
  if (cook.pickupCity) locationParts.push(cook.pickupCity);
  if (cook.distanceKm != null) locationParts.push(`${cook.distanceKm} km`);

  const locationLine =
    locationParts.length > 0 ? locationParts.join(" · ") : null;

  return (
    <Link href={`/app/cooks/${cook.id}/menu`} className={styles.card}>
      <div className={styles.cardCover}>
        {cook.bannerUrl || cook.representativeDishPhoto ? (
          // biome-ignore lint/performance/noImgElement: kitchen cover
          <img
            src={cook.bannerUrl ?? cook.representativeDishPhoto ?? undefined}
            alt=""
            className={styles.cardImage}
          />
        ) : (
          <div className={styles.cardCoverPlaceholder} />
        )}
        {schedule?.orderLeftLabel && (
          <span
            className={`${styles.orderLeftPill} ${schedule.urgent ? styles.orderLeftPillUrgent : ""}`}
          >
            {schedule.orderLeftLabel}
          </span>
        )}
        <div className={styles.cardAvatar}>
          {cook.photoUrl ? (
            // biome-ignore lint/performance/noImgElement: cook avatar
            <img src={cook.photoUrl} alt="" className={styles.cookAvatarImg} />
          ) : (
            initials(cook.displayName)
          )}
        </div>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.titleRow}>
          <h3 className={styles.cardTitle}>{kitchenDisplayName(cook)}</h3>
          <div className={styles.titleMeta}>
            <CookCardRating
              rating={cook.rating}
              reviewCount={cook.reviewCount}
            />
            {cook.priceFrom != null && (
              <>
                <span className={styles.metaDot} aria-hidden />
                <span className={styles.metaPrice}>
                  From ${cook.priceFrom.toFixed(2)}
                </span>
              </>
            )}
          </div>
        </div>

        {(locationLine || schedule?.schedule) && (
          <div className={styles.metaLine}>
            {locationLine && (
              <span className={styles.metaLineLeft}>{locationLine}</span>
            )}
            {schedule?.schedule && (
              <span className={styles.metaLineRight}>{schedule.schedule}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export function CookGrid({
  cooks,
  fulfillmentMode,
}: {
  cooks: BrowseCookCard[];
  fulfillmentMode: "pickup" | "delivery";
}) {
  return (
    <div className={styles.grid}>
      {cooks.map((cook) => (
        <CookCardLink
          key={cook.id}
          cook={cook}
          fulfillmentMode={fulfillmentMode}
        />
      ))}
    </div>
  );
}
