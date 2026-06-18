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
import { notFound, useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { formatLeadTime } from "@/lib/refund-policy";
import styles from "./page.module.css";

// ── API types ─────────────────────────────────────────────────────────────────

type ApiCook = {
  id: string;
  userId: string;
  name: string;
  photoUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  cuisineTypes: string[];
  neighborhood: string | null;
  rating: number | null;
  reviewCount: number;
  yearsExperience: number | null;
  isVerified: boolean;
  memberSince: string | null;
  ordersCompleted: number;
  leadTime: string | null;
  minOrderQty: number;
  maxOrderQty: number | null;
  cancellationAllowed: boolean;
};

type ApiReview = {
  id: string;
  rating: number;
  comment: string | null;
  reviewerName: string;
  dishes: string[];
  createdAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function cuisineSubtitle(types: string[]): string {
  if (types.length === 0) return "Home cook";
  return types.map((t) => `${t} cuisine`).join(" · ");
}

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CookProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [following, setFollowing] = useState(false);

  // ── API state ──────────────────────────────────────────────────────────────
  const [cook, setCook] = useState<ApiCook | null>(null);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  useEffect(() => {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

    let cancelled = false;

    async function fetchData() {
      try {
        const [cookRes, reviewsRes] = await Promise.all([
          fetch(`${baseUrl}/api/cooks/${id}`, { cache: "no-store" }),
          fetch(`${baseUrl}/api/cooks/${id}/reviews`, { cache: "no-store" }),
        ]);

        if (!cookRes.ok) {
          if (!cancelled) setNotFoundFlag(true);
          return;
        }

        const cookJson = await cookRes.json();
        const reviewsJson = reviewsRes.ok
          ? await reviewsRes.json()
          : { data: [] };

        if (!cancelled) {
          setCook(cookJson.data);
          setReviews(reviewsJson.data ?? []);
        }
      } catch {
        if (!cancelled) setNotFoundFlag(true);
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (notFoundFlag) {
    notFound();
  }

  if (!cook) {
    return (
      <div className={styles.page}>
        <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
          Loading…
        </div>
      </div>
    );
  }

  const cookInitials = nameInitials(cook.name);

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
        {/* Top row: avatar · name · follow */}
        <div className={styles.headerTop}>
          <div className={styles.avatarWrap}>
            {cook.photoUrl ? (
              // biome-ignore lint/performance/noImgElement: avatar
              <img
                src={cook.photoUrl}
                alt={cook.name}
                className={styles.avatarImg}
              />
            ) : (
              <div
                className={styles.avatarImg}
                style={{
                  background:
                    "linear-gradient(135deg, #6b6b6b 0%, #3a3a3a 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "1.25rem",
                }}
              >
                {cookInitials}
              </div>
            )}
          </div>
          <div className={styles.nameBlock}>
            <h1 className={styles.name}>{cook.name}</h1>
            {cook.isVerified && (
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

        {/* Full-width details */}
        <p className={styles.cuisineLine}>
          {cuisineSubtitle(cook.cuisineTypes)}
          {cook.yearsExperience !== null
            ? ` · ${cook.yearsExperience} years experience`
            : ""}
        </p>

        <div className={styles.ratingRow}>
          <Star size={15} fill="currentColor" className={styles.ratingStar} />
          <span className={styles.ratingBig}>
            {cook.rating !== null ? cook.rating : "–"}
          </span>
          <span className={styles.ratingCount}>
            ({cook.reviewCount} reviews)
          </span>
          {cook.neighborhood && (
            <>
              <span className={styles.ratingDot}>·</span>
              <MapPin size={13} className={styles.ratingLocIcon} />
              <span className={styles.ratingLoc}>
                {cook.neighborhood}, Toronto
              </span>
            </>
          )}
        </div>

        <div className={styles.statsStrip}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>{cook.ordersCompleted}</span>
            <span className={styles.statLabel}>meals made</span>
          </div>
          {cook.yearsExperience !== null && (
            <>
              <span className={styles.statSep} />
              <div className={styles.statItem}>
                <span className={styles.statNum}>{cook.yearsExperience}</span>
                <span className={styles.statLabel}>years cooking</span>
              </div>
            </>
          )}
          {cook.memberSince && (
            <>
              <span className={styles.statSep} />
              <div className={styles.statItem}>
                <span className={styles.statNum}>{cook.memberSince}</span>
                <span className={styles.statLabel}>member since</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className={styles.body}>
        {cook.bio && (
          <section className={styles.section}>
            <p className={styles.bio}>{cook.bio}</p>
            {cook.leadTime && (
              <div className={styles.leadTimeWrap}>
                <span className={styles.leadTimeBadge}>
                  <Clock size={11} />
                  {formatLeadTime(cook.leadTime)} notice
                </span>
              </div>
            )}
          </section>
        )}

        {/* Order CTA + policies */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Ordering</h2>
          <p className={styles.noListings}>
            Minimum {cook.minOrderQty} item{cook.minOrderQty === 1 ? "" : "s"}
            {cook.maxOrderQty ? ` · maximum ${cook.maxOrderQty}` : ""} per
            order.
          </p>
          <p className={styles.noListings}>
            {cook.cancellationAllowed
              ? "Cancellations accepted before the lead time for a full refund."
              : "No cancellations once an order is placed."}
          </p>
          <Link
            href={`/app/cooks/${id}/menu`}
            className={styles.followBtn}
            style={{ marginTop: 12, display: "inline-block" }}
          >
            Order now
          </Link>
        </section>

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Reviews
              {cook.rating !== null && (
                <span className={styles.sectionRating}>
                  <Star size={14} fill="currentColor" />
                  {cook.rating}
                </span>
              )}
            </h2>
            <div className={styles.reviewList}>
              {reviews.map((review) => (
                <div key={review.id} className={styles.reviewCard}>
                  <div className={styles.reviewTop}>
                    <div className={styles.reviewerAvatar}>
                      {nameInitials(review.reviewerName)}
                    </div>
                    <div className={styles.reviewerInfo}>
                      <span className={styles.reviewerName}>
                        {review.reviewerName}
                      </span>
                      <span className={styles.reviewDate}>
                        {formatReviewDate(review.createdAt)}
                      </span>
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
                  <p className={styles.reviewComment}>{review.comment ?? ""}</p>
                  {review.dishes.length > 0 && (
                    <span className={styles.reviewDish}>
                      Ordered: {review.dishes.join(", ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
