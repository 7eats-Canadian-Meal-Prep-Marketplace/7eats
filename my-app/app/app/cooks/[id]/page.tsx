"use client";

import { ArrowLeft, CheckCircle, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import {
  type DietaryBadge,
  MOCK_COOKS,
  MOCK_LISTINGS,
  MOCK_REVIEWS,
} from "../../_mock";
import styles from "./page.module.css";

function badgeLabel(badge: DietaryBadge): string {
  const map: Record<DietaryBadge, string> = {
    halal: "Halal",
    vegan: "Vegan",
    vegetarian: "Vegetarian",
    "gluten-free": "Gluten-free",
    "dairy-free": "Dairy-free",
    "nut-free": "Nut-free",
    kosher: "Kosher",
  };
  return map[badge];
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

  return (
    <div className={styles.page}>
      {/* Cover */}
      <div className={styles.cover} style={{ background: cook.gradient }}>
        <Link href="/app/browse" className={styles.backBtn}>
          <ArrowLeft size={20} />
        </Link>
      </div>

      {/* Profile header */}
      <div className={styles.profileHeader}>
        <div className={styles.avatar} style={{ background: cook.gradient }}>
          {cook.initials}
        </div>
        <div className={styles.headerInfo}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{cook.displayName}</h1>
            {cook.verified && (
              <CheckCircle size={18} className={styles.verifiedIcon} />
            )}
          </div>
          <div className={styles.metaRow}>
            <MapPin size={13} className={styles.metaIcon} />
            <span className={styles.metaText}>
              {cook.neighborhood}, Toronto
            </span>
          </div>
          <div className={styles.metaRow}>
            <Star size={13} fill="currentColor" className={styles.starIcon} />
            <span className={styles.metaText}>
              <strong>{cook.rating}</strong>
              <span className={styles.reviewCount}>
                {" "}
                ({cook.reviewCount} reviews)
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {/* Badges */}
        {cook.badges.length > 0 && (
          <div className={styles.badges}>
            {cook.badges.map((b) => (
              <span key={b} className={styles.badge}>
                {badgeLabel(b)}
              </span>
            ))}
            {cook.cuisineTypes.map((c) => (
              <span key={c} className={styles.cuisineBadge}>
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        <section className={styles.section}>
          <p className={styles.bio}>{cook.bio}</p>
          <p className={styles.leadTime}>{cook.leadTime}</p>
        </section>

        {/* Active listings */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Available now
            <span className={styles.listingCount}>{listings.length}</span>
          </h2>
          {listings.length === 0 ? (
            <p className={styles.noListings}>
              No active listings right now. Check back soon!
            </p>
          ) : (
            <div className={styles.listingList}>
              {listings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/app/listings/${listing.id}`}
                  className={styles.listingCard}
                >
                  <div
                    className={styles.listingCover}
                    style={{ background: listing.gradient }}
                  />
                  <div className={styles.listingInfo}>
                    <h3 className={styles.listingTitle}>{listing.title}</h3>
                    <p className={styles.listingMeta}>
                      Pickup {listing.pickupDate} · {listing.pickupWindow}
                    </p>
                    <p className={styles.listingPrice}>
                      From ${listing.priceFrom} ·{" "}
                      <span
                        className={
                          listing.ordersLeft <= 3 ? styles.spotLow : ""
                        }
                      >
                        {listing.ordersLeft} spot
                        {listing.ordersLeft !== 1 ? "s" : ""} left
                      </span>
                    </p>
                  </div>
                  <span className={styles.listingArrow}>→</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Reviews
              <span className={styles.ratingPill}>★ {cook.rating}</span>
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
