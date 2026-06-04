"use client";

import { Bookmark, Heart, RefreshCw, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "../_app-context";
import { scheduleLine } from "../_listing-card-utils";

function formatDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`;
}

import { MOCK_COOKS, MOCK_LISTINGS } from "../_mock";
import styles from "./page.module.css";

type Tab = "listings" | "cooks";

export default function SavedPage() {
  const { fulfillment } = useApp();
  const [tab, setTab] = useState<Tab>("listings");
  const [savedListings, setSavedListings] = useState<Set<string>>(
    new Set(["listing-1", "listing-3"]),
  );
  const [savedCooks, setSavedCooks] = useState<Set<string>>(
    new Set(["cook-1", "cook-4"]),
  );

  const unsaveListing = (id: string) =>
    setSavedListings((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const unsaveCook = (id: string) =>
    setSavedCooks((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const listings = MOCK_LISTINGS.filter((l) => savedListings.has(l.id));
  const cooks = MOCK_COOKS.filter((c) => savedCooks.has(c.id));

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>Favourites</h1>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === "listings" ? styles.tabActive : ""}`}
            onClick={() => setTab("listings")}
          >
            Listings
            {savedListings.size > 0 && (
              <span className={styles.tabCount}>{savedListings.size}</span>
            )}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === "cooks" ? styles.tabActive : ""}`}
            onClick={() => setTab("cooks")}
          >
            Cooks
            {savedCooks.size > 0 && (
              <span className={styles.tabCount}>{savedCooks.size}</span>
            )}
          </button>
        </div>

        {tab === "listings" && (
          <div>
            {listings.length === 0 ? (
              <div className={styles.empty}>
                <Heart size={40} className={styles.emptyIcon} />
                <h2 className={styles.emptyTitle}>No favourite listings</h2>
                <p className={styles.emptyDesc}>
                  Tap the heart on any listing to save it here.
                </p>
                <Link href="/app/browse" className={styles.browseBtn}>
                  Browse listings
                </Link>
              </div>
            ) : (
              <div className={styles.grid}>
                {listings.map((listing) => {
                  const cook =
                    MOCK_COOKS.find((c) => c.id === listing.cookId) ??
                    MOCK_COOKS[0];
                  const spotsLow =
                    listing.ordersLeft > 0 && listing.ordersLeft <= 5;
                  const spotsOut = listing.ordersLeft === 0;
                  const schedule = scheduleLine(listing, fulfillment);

                  return (
                    /* Same card structure as search/browse */
                    <Link
                      key={listing.id}
                      href={`/app/listings/${listing.id}`}
                      className={styles.card}
                    >
                      <div className={styles.cardCover}>
                        {listing.deal && (
                          <span className={styles.dealBadge}>
                            {listing.deal.badge}
                          </span>
                        )}
                        <Image
                          src={listing.image}
                          alt={listing.title}
                          fill
                          className={styles.cardImage}
                          sizes="(max-width: 560px) 100vw, (max-width: 860px) 50vw, 33vw"
                        />
                        {/* Heart always active (it's saved) */}
                        <button
                          type="button"
                          className={`${styles.heartBtn} ${styles.heartBtnActive}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            unsaveListing(listing.id);
                          }}
                          aria-label="Remove from saved"
                        >
                          <Heart
                            size={16}
                            strokeWidth={2}
                            fill="currentColor"
                          />
                        </button>
                        {spotsOut ? (
                          <span
                            className={`${styles.stockPill} ${styles.stockOut}`}
                          >
                            Sold out
                          </span>
                        ) : spotsLow ? (
                          <span
                            className={`${styles.stockPill} ${styles.stockLow}`}
                          >
                            {listing.ordersLeft} left
                          </span>
                        ) : null}
                        {listing.fulfillment !== "both" && (
                          <span className={styles.fulfillmentPill}>
                            {listing.fulfillment === "pickup"
                              ? "Pickup only"
                              : "Delivery only"}
                          </span>
                        )}
                      </div>

                      <div className={styles.cardBody}>
                        <div className={styles.titleRow}>
                          <h3 className={styles.cardTitle}>{listing.title}</h3>
                          <span className={styles.rating}>
                            <Star
                              size={12}
                              fill="currentColor"
                              className={styles.star}
                            />
                            <span className={styles.ratingValue}>
                              {cook.rating.toFixed(1)}
                            </span>
                          </span>
                        </div>

                        <p className={styles.metaLine}>
                          {cook.displayName.split(" ")[0]} ·{" "}
                          {formatDist(listing.distanceKm)} ·{" "}
                          <span className={styles.metaPrice}>
                            From ${listing.priceFrom}
                          </span>
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
                          <span className={styles.scheduleMuted}>
                            {schedule.receiveOn}
                          </span>
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "cooks" && (
          <div>
            {cooks.length === 0 ? (
              <div className={styles.empty}>
                <Bookmark size={40} className={styles.emptyIcon} />
                <h2 className={styles.emptyTitle}>No followed cooks</h2>
                <p className={styles.emptyDesc}>
                  Follow your favourite cooks to keep up when they post new
                  listings.
                </p>
                <Link href="/app/browse" className={styles.browseBtn}>
                  Discover cooks
                </Link>
              </div>
            ) : (
              <div className={styles.cookList}>
                {cooks.map((cook) => (
                  <div key={cook.id} className={styles.cookCard}>
                    <Link
                      href={`/app/cooks/${cook.id}`}
                      className={styles.cookCardLink}
                    >
                      <div
                        className={styles.cookAvatar}
                        style={{ background: cook.gradient }}
                      >
                        {cook.initials}
                      </div>
                      <div className={styles.cookInfo}>
                        <span className={styles.cookName}>
                          {cook.displayName}
                        </span>
                        <span className={styles.cookMeta}>
                          {cook.cuisineTypes[0]} cuisine · {cook.neighborhood}
                        </span>
                        <span className={styles.cookRating}>
                          <Star
                            size={12}
                            fill="currentColor"
                            className={styles.star}
                          />
                          {cook.rating} ({cook.reviewCount})
                        </span>
                      </div>
                    </Link>
                    <button
                      type="button"
                      className={styles.unsaveBtn}
                      onClick={() => unsaveCook(cook.id)}
                      aria-label="Unfollow cook"
                    >
                      <Bookmark size={16} fill="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
