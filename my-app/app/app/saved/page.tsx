"use client";

import { Bookmark, Heart, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MOCK_COOKS, MOCK_LISTINGS } from "../_mock";
import styles from "./page.module.css";

type Tab = "listings" | "cooks";

export default function SavedPage() {
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
        <h1 className={styles.heading}>Saved</h1>

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
                <h2 className={styles.emptyTitle}>No saved listings</h2>
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
                  return (
                    <div key={listing.id} className={styles.card}>
                      <Link
                        href={`/app/listings/${listing.id}`}
                        className={styles.cardLink}
                      >
                        <div
                          className={styles.cardCover}
                          style={{ background: listing.gradient }}
                        >
                          <span className={styles.cardEmoji}>
                            {listing.emoji}
                          </span>
                        </div>
                        <div className={styles.cardBody}>
                          <div className={styles.cardCook}>
                            <div
                              className={styles.cookDot}
                              style={{ background: cook.gradient }}
                            >
                              {cook.initials}
                            </div>
                            {cook.displayName}
                          </div>
                          <h3 className={styles.cardTitle}>{listing.title}</h3>
                          <p className={styles.cardMeta}>
                            📅 {listing.pickupDate} · From ${listing.priceFrom}
                          </p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        className={styles.unsaveBtn}
                        onClick={() => unsaveListing(listing.id)}
                        aria-label="Remove from saved"
                      >
                        <Heart size={16} fill="currentColor" />
                      </button>
                    </div>
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
                <h2 className={styles.emptyTitle}>No saved cooks</h2>
                <p className={styles.emptyDesc}>
                  Follow your favourite cooks to get notified when they post new
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
                          {cook.cuisineTypes[0]} · {cook.neighborhood}
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
