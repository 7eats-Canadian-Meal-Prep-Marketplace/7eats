"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  Heart,
  MapPin,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import {
  dietaryLabel,
  listingDietaryBadge,
  listingSummaryPreview,
  nicheLabel,
} from "../../_listing-card-utils";
import { MOCK_COOKS, MOCK_LISTINGS, MOCK_REVIEWS } from "../../_mock";
import styles from "./page.module.css";

function cuisineSubtitle(types: string[]): string {
  return types.map((t) => `${t} cuisine`).join(" · ");
}

function memberSinceYear(value: string): string {
  const match = value.match(/\d{4}/);
  return match?.[0] ?? value;
}

export default function CookProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const cook = MOCK_COOKS.find((c) => c.id === id) ?? MOCK_COOKS[0];
  const listings = MOCK_LISTINGS.filter((l) => l.cookId === cook.id);
  const reviews = MOCK_REVIEWS[cook.id] ?? [];
  const router = useRouter();
  const [following, setFollowing] = useState(false);
  const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className={styles.page}>
      {/* ── Breadcrumb back link ─────────────────────────────────────────── */}
      <div className={styles.breadcrumb}>
        <button
          type="button"
          className={styles.backLink}
          onClick={() => router.back()}
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          Back
        </button>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={styles.headerCard}>
        {/* Top row: avatar · name · follow — compact, doesn't fight for width */}
        <div className={styles.headerTop}>
          <div className={styles.avatarWrap}>
            {/* biome-ignore lint/performance/noImgElement: profile placeholder */}
            <img
              src="/placeholder.jpg"
              alt={cook.displayName}
              className={styles.avatarImg}
            />
          </div>
          <div className={styles.nameBlock}>
            <h1 className={styles.name}>{cook.displayName}</h1>
            {cook.verified && (
              <BadgeCheck
                size={18}
                className={styles.verifiedIcon}
                aria-label="Verified cook"
              />
            )}
          </div>
          <button
            type="button"
            className={`${styles.followBtn} ${following ? styles.followBtnActive : ""}`}
            onClick={() => setFollowing((f) => !f)}
          >
            <Heart
              size={13}
              fill={following ? "currentColor" : "none"}
              strokeWidth={following ? 0 : 2}
            />
            {following ? "Following" : "Follow"}
          </button>
        </div>

        {/* Full-width details — matches body column width */}
        <p className={styles.cuisineLine}>
          {cuisineSubtitle(cook.cuisineTypes)} · {cook.yearsExperience} years
          experience
        </p>

        <div className={styles.ratingRow}>
          <Star size={15} fill="currentColor" className={styles.ratingStar} />
          <span className={styles.ratingBig}>{cook.rating}</span>
          <span className={styles.ratingCount}>
            ({cook.reviewCount} reviews)
          </span>
          <span className={styles.ratingDot}>·</span>
          <MapPin size={13} className={styles.ratingLocIcon} />
          <span className={styles.ratingLoc}>{cook.neighborhood}, Toronto</span>
        </div>

        <div className={styles.statsStrip}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>{cook.ordersCompleted}</span>
            <span className={styles.statLabel}>meals made</span>
          </div>
          <span className={styles.statSep} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>{cook.yearsExperience}</span>
            <span className={styles.statLabel}>years cooking</span>
          </div>
          <span className={styles.statSep} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>
              {memberSinceYear(cook.memberSince)}
            </span>
            <span className={styles.statLabel}>member since</span>
          </div>
        </div>

        {(cook.pickupDays?.length || cook.deliveryDays?.length) && (
          <div className={styles.availabilityBlock}>
            {cook.pickupDays && cook.pickupDays.length > 0 && (
              <div className={styles.availRow}>
                <span className={styles.availLabel}>Pickup</span>
                <div className={styles.dayChips}>
                  {ALL_DAYS.map((d) => {
                    const on = cook.pickupDays?.includes(d);
                    return (
                      <span
                        key={d}
                        className={`${styles.dayChip} ${on ? styles.dayChipOn : styles.dayChipOff}`}
                      >
                        {d}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {cook.deliveryDays && cook.deliveryDays.length > 0 && (
              <div className={styles.availRow}>
                <span className={styles.availLabel}>Delivery</span>
                <div className={styles.dayChips}>
                  {ALL_DAYS.map((d) => {
                    const on = cook.deliveryDays?.includes(d);
                    return (
                      <span
                        key={d}
                        className={`${styles.dayChip} ${on ? styles.dayChipOn : styles.dayChipOff}`}
                      >
                        {d}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className={styles.body}>
        <section className={styles.section}>
          <p className={styles.bio}>{cook.bio}</p>
          <div className={styles.leadTimeWrap}>
            <span className={styles.leadTimeBadge}>
              <Clock size={11} />
              {cook.leadTime}
            </span>
          </div>
        </section>

        {/* Active listings */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Available now
            <span className={styles.listingCount}>{listings.length}</span>
          </h2>
          {listings.length === 0 ? (
            <p className={styles.noListings}>No active listings right now.</p>
          ) : (
            <div className={styles.listingList}>
              {listings.map((listing) => {
                const summary = listingSummaryPreview(listing);
                const dietary = listingDietaryBadge(listing);
                const niche = listing.niches[0];
                const spotsLow = listing.ordersLeft <= 3;
                const spotsOut = listing.ordersLeft === 0;
                const metaParts: string[] = [];
                if (dietary) metaParts.push(dietaryLabel(dietary));
                if (niche) metaParts.push(nicheLabel(niche));
                if (listing.deal) metaParts.push(listing.deal.badge);

                return (
                  <Link
                    key={listing.id}
                    href={`/app/listings/${listing.id}`}
                    className={styles.listingCard}
                  >
                    <div
                      className={styles.listingCover}
                      style={{ background: listing.gradient }}
                    >
                      {/* biome-ignore lint/performance/noImgElement: thumbnail in client component */}
                      <img
                        src={listing.image}
                        alt=""
                        aria-hidden="true"
                        className={styles.listingCoverImg}
                      />
                    </div>
                    <div className={styles.listingMain}>
                      <div className={styles.listingHeader}>
                        <h3 className={styles.listingTitle}>{listing.title}</h3>
                        <span className={styles.listingPrice}>
                          From ${listing.priceFrom}
                        </span>
                      </div>
                      <p className={styles.listingSummary}>{summary}</p>
                      <div className={styles.listingFooter}>
                        {metaParts.length > 0 && (
                          <div className={styles.listingMeta}>
                            {metaParts.map((part, i) => (
                              <span
                                key={`${listing.id}-meta-${i}`}
                                className={
                                  listing.deal?.badge === part
                                    ? styles.listingMetaDeal
                                    : styles.listingMetaLabel
                                }
                              >
                                {part}
                              </span>
                            ))}
                          </div>
                        )}
                        <span
                          className={
                            spotsOut
                              ? styles.listingSpotsOut
                              : spotsLow
                                ? styles.listingSpotsLow
                                : styles.listingSpots
                          }
                        >
                          {spotsOut
                            ? "Sold out"
                            : `${listing.ordersLeft} spots left`}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Reviews
              <span className={styles.sectionRating}>
                <Star size={14} fill="currentColor" />
                {cook.rating}
              </span>
            </h2>
            <div className={styles.reviewList}>
              {reviews.map((review) => (
                <div key={review.id} className={styles.reviewCard}>
                  <div className={styles.reviewTop}>
                    <div className={styles.reviewerAvatar}>
                      {review.clientInitials}
                    </div>
                    <div className={styles.reviewerInfo}>
                      <span className={styles.reviewerName}>
                        {review.clientName}
                      </span>
                      <span className={styles.reviewDate}>{review.date}</span>
                    </div>
                    <div className={styles.stars}>
                      {Array.from({ length: 5 }, (_, i) => i).map((i) => (
                        <Star
                          key={`star-${i}`}
                          size={13}
                          fill={i < review.rating ? "currentColor" : "none"}
                          className={
                            i < review.rating
                              ? styles.starFilled
                              : styles.starEmpty
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <p className={styles.reviewComment}>{review.comment}</p>
                  <span className={styles.reviewDish}>
                    {review.orderedDish}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
