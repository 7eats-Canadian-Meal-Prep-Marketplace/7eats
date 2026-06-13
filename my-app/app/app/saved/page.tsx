"use client";

import { Bookmark, Heart, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type SavedListing = {
  id: string;
  title: string;
  description: string | null;
  cookId: string;
  cookName: string;
  cookFirstName: string | null;
  type: string;
  subscriptionEnabled: boolean;
  basePrice: number;
  currency: string;
  coverPhotoUrl: string | null;
  savedAt: string;
};

type FollowedCook = {
  id: string;
  name: string;
  firstName: string | null;
  neighborhood: string | null;
  rating: number | null;
  isVerified: boolean;
  followedAt: string;
};

type Tab = "listings" | "cooks";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number, currency: string): string {
  return `From $${price}${currency !== "CAD" ? ` ${currency}` : ""}`;
}

function cookDisplayName(listing: SavedListing): string {
  return listing.cookFirstName ?? listing.cookName ?? "Chef";
}

function cookInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SavedPage() {
  const [tab, setTab] = useState<Tab>("listings");
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [followedCooks, setFollowedCooks] = useState<FollowedCook[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/favourites/listings").then((r) => {
        if (r.status === 401) throw new Error("unauthorized");
        return r.json();
      }),
      fetch("/api/favourites/cooks").then((r) => {
        if (r.status === 401) throw new Error("unauthorized");
        return r.json();
      }),
    ])
      .then(([listingsJson, cooksJson]) => {
        setSavedListings(listingsJson.data ?? []);
        setFollowedCooks(cooksJson.data ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === "unauthorized") {
          setAuthError(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleUnsaveListing(listingId: string) {
    await fetch(`/api/favourites/listings/${listingId}`, { method: "DELETE" });
    setSavedListings((prev) => prev.filter((l) => l.id !== listingId));
  }

  async function handleUnfollowCook(cookId: string) {
    await fetch(`/api/favourites/cooks/${cookId}`, { method: "DELETE" });
    setFollowedCooks((prev) => prev.filter((c) => c.id !== cookId));
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <h1 className={styles.heading}>Favourites</h1>
          <div className={styles.empty}>
            <p className={styles.emptyDesc}>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Auth error ─────────────────────────────────────────────────────────────

  if (authError) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <h1 className={styles.heading}>Favourites</h1>
          <div className={styles.empty}>
            <Heart size={40} className={styles.emptyIcon} />
            <h2 className={styles.emptyTitle}>
              Sign in to see your favourites
            </h2>
            <p className={styles.emptyDesc}>
              Create an account or sign in to save listings and follow cooks.
            </p>
            <Link href="/app-auth/sign-in" className={styles.browseBtn}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

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
            {savedListings.length > 0 && (
              <span className={styles.tabCount}>{savedListings.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === "cooks" ? styles.tabActive : ""}`}
            onClick={() => setTab("cooks")}
          >
            Cooks
            {followedCooks.length > 0 && (
              <span className={styles.tabCount}>{followedCooks.length}</span>
            )}
          </button>
        </div>

        {tab === "listings" && (
          <div>
            {savedListings.length === 0 ? (
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
                {savedListings.map((listing) => (
                  <Link
                    key={listing.id}
                    href={`/app/listings/${listing.id}`}
                    className={styles.card}
                  >
                    <div className={styles.cardCover}>
                      <Image
                        src={listing.coverPhotoUrl ?? "/placeholder.jpg"}
                        alt={listing.title}
                        fill
                        className={styles.cardImage}
                        sizes="(max-width: 560px) 100vw, (max-width: 860px) 50vw, 33vw"
                      />
                      {/* Heart always active — everything here is saved */}
                      <button
                        type="button"
                        className={`${styles.heartBtn} ${styles.heartBtnActive}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleUnsaveListing(listing.id);
                        }}
                        aria-label="Remove from saved"
                      >
                        <Heart size={16} strokeWidth={2} fill="currentColor" />
                      </button>
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.titleRow}>
                        <h3 className={styles.cardTitle}>{listing.title}</h3>
                      </div>

                      <p className={styles.metaLine}>
                        {cookDisplayName(listing)}
                        {" · "}
                        <span className={styles.metaPrice}>
                          {formatPrice(listing.basePrice, listing.currency)}
                        </span>
                        {listing.subscriptionEnabled && (
                          <span className={styles.subHint}>
                            <RefreshCw size={10} />
                            Subscribe
                          </span>
                        )}
                      </p>

                      <p className={styles.scheduleLine}>
                        <span className={styles.scheduleMuted}>
                          {listing.type === "subscription"
                            ? "Subscription"
                            : "Single order"}
                        </span>
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "cooks" && (
          <div>
            {followedCooks.length === 0 ? (
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
                {followedCooks.map((cook) => (
                  <div key={cook.id} className={styles.cookCard}>
                    <Link
                      href={`/app/cooks/${cook.id}`}
                      className={styles.cookCardLink}
                    >
                      <div className={styles.cookAvatar}>
                        {cookInitials(cook.name ?? cook.firstName ?? "?")}
                      </div>
                      <div className={styles.cookInfo}>
                        <span className={styles.cookName}>{cook.name}</span>
                        <span className={styles.cookMeta}>
                          {cook.neighborhood ?? "Home cook"}
                          {cook.isVerified ? " · Verified" : ""}
                        </span>
                        {cook.rating != null && (
                          <span className={styles.cookRating}>
                            {cook.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </Link>
                    <button
                      type="button"
                      className={styles.unsaveBtn}
                      onClick={() => handleUnfollowCook(cook.id)}
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
