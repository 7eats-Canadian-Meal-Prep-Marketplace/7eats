"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Globe,
  Heart,
  MapPin,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import {
  fetchCookFollowState,
  followCook,
  unfollowCook,
} from "@/lib/favourites/follow-cook";
import {
  describeCancellationPolicy,
  describeLeadTimePolicy,
  formatLeadTime,
} from "@/lib/refund-policy";
import { useApp } from "../../_app-context";
import { Skeleton } from "../../_skeleton";
import styles from "./page.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────
type Window = { dayOfWeek: string; fromTime: string; toTime: string };

type ApiCook = {
  id: string;
  name: string;
  displayName: string | null;
  photoUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  socialLink: string | null;
  cuisineTypes: string[];
  niches: string[];
  dietaryTags: string[];
  neighborhood: string | null;
  pickupCity: string | null;
  rating: number | null;
  reviewCount: number;
  yearsExperience: number | null;
  isVerified: boolean;
  memberSince: string | null;
  ordersCompleted: number;
  leadTime: string | null;
  leadTimeCutoff: string | null;
  offersPickup: boolean;
  delivery: "none" | "self" | null;
  pickupWindows: Window[];
  deliveryWindows: Window[];
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
const DAY_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const DAY_SHORT: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${hour}${period}`
    : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function summarizeWindows(windows: Window[]): string {
  if (windows.length === 0) return "";
  const ordered = [...windows].sort(
    (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
  );
  const days = ordered.map((w) => DAY_SHORT[w.dayOfWeek] ?? w.dayOfWeek);
  const uniform = ordered.every(
    (w) => w.fromTime === ordered[0].fromTime && w.toTime === ordered[0].toTime,
  );
  const range = uniform
    ? `${fmtTime(ordered[0].fromTime)}–${fmtTime(ordered[0].toTime)}`
    : "times vary by day";
  return `${days.join(", ")} · ${range}`;
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

function formatMealsMade(count: number): string {
  return count === 1 ? "1 meal made" : `${count.toLocaleString()} meals made`;
}

function scrollToReviews() {
  document
    .getElementById("reviews")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function socialMeta(raw: string): { href: string; label: string } {
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const label = /instagram\.com/i.test(raw) ? "Instagram" : "Website";
  return { href: url, label };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CookProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { isLoggedIn } = useApp();
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

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

  useEffect(() => {
    if (!isLoggedIn || !id) return;
    let cancelled = false;
    void fetchCookFollowState(id).then((state) => {
      if (!cancelled && state !== null) setFollowing(state);
    });
    return () => {
      cancelled = true;
    };
  }, [id, isLoggedIn]);

  async function toggleFollow() {
    if (!isLoggedIn) {
      router.push(`/app-auth/login?next=/app/cooks/${id}`);
      return;
    }
    if (followLoading) return;

    const next = !following;
    setFollowLoading(true);
    const result = next ? await followCook(id) : await unfollowCook(id);
    if (result === "auth") {
      router.push(`/app-auth/login?next=/app/cooks/${id}`);
    } else if (result === "ok") {
      setFollowing(next);
    }
    setFollowLoading(false);
  }

  if (notFoundFlag) notFound();

  if (!cook) {
    return (
      <div className={styles.page}>
        <div className={styles.hero}>
          <Skeleton height={120} radius={0} />
          <div className={styles.heroBody}>
            <Skeleton
              circle
              width={84}
              height={84}
              style={{ marginTop: -50 }}
            />
            <Skeleton
              width="50%"
              height={24}
              radius={6}
              style={{ marginTop: 12 }}
            />
            <Skeleton
              width="35%"
              height={14}
              radius={6}
              style={{ marginTop: 8 }}
            />
          </div>
        </div>
      </div>
    );
  }

  const kitchen = cook.displayName?.trim();
  const cuisines = cook.cuisineTypes;
  const location = cook.pickupCity ?? cook.neighborhood;
  const social = cook.socialLink ? socialMeta(cook.socialLink) : null;
  const orderSize =
    cook.maxOrderQty != null
      ? `${cook.minOrderQty}–${cook.maxOrderQty} plates`
      : cook.minOrderQty > 1
        ? `${cook.minOrderQty}+ plates`
        : null;
  const pickupSummary = cook.offersPickup
    ? summarizeWindows(cook.pickupWindows)
    : "";
  const deliverySummary =
    cook.delivery === "self" ? summarizeWindows(cook.deliveryWindows) : "";

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={styles.back}
        onClick={() => router.back()}
      >
        <ArrowLeft size={15} strokeWidth={2.5} />
        Back
      </button>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <header className={styles.hero}>
        <div className={styles.cover}>
          {cook.bannerUrl ? (
            <Image
              src={cook.bannerUrl}
              alt=""
              fill
              className={styles.coverImg}
              sizes="(max-width: 768px) 100vw, 960px"
              priority
            />
          ) : (
            <div className={styles.coverFallback} />
          )}
        </div>

        <div className={styles.heroBody}>
          <div className={styles.avatar}>
            {cook.photoUrl ? (
              <Image
                src={cook.photoUrl}
                alt={cook.name}
                fill
                className={styles.avatarImg}
                sizes="80px"
              />
            ) : (
              <span>{nameInitials(cook.name)}</span>
            )}
          </div>

          <div className={styles.heroRow}>
            <div className={styles.heroId}>
              <h1 className={styles.name}>
                <span>{cook.name}</span>
                {cook.isVerified && (
                  <BadgeCheck
                    size={19}
                    className={styles.verified}
                    aria-label="Verified cook"
                  />
                )}
              </h1>
              <div className={styles.heroSub}>
                {kitchen && <span className={styles.kitchen}>{kitchen}</span>}
                {social && (
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                  >
                    <Globe size={14} />
                    {social.label}
                  </a>
                )}
              </div>
            </div>

            {isLoggedIn && (
              <button
                type="button"
                className={`${styles.followBtn} ${following ? styles.followBtnActive : ""}`}
                disabled={followLoading}
                onClick={() => void toggleFollow()}
              >
                <Heart
                  size={13}
                  fill={following ? "currentColor" : "none"}
                  strokeWidth={following ? 0 : 2}
                />
                {following ? "Following" : "Follow"}
              </button>
            )}
          </div>

          <div className={styles.ratingRow}>
            <Star size={15} fill="currentColor" className={styles.ratingStar} />
            <span className={styles.ratingVal}>
              {(cook.rating ?? 0).toFixed(1)}
            </span>
            <button
              type="button"
              className={styles.reviewLink}
              onClick={scrollToReviews}
            >
              {cook.reviewCount} review{cook.reviewCount === 1 ? "" : "s"}
            </button>
            {location && (
              <span className={styles.ratingLoc}>
                <MapPin size={13} /> {location}
              </span>
            )}
          </div>

          {(cuisines.length > 0 ||
            cook.niches.length > 0 ||
            cook.dietaryTags.length > 0) && (
            <div className={styles.tagGroups}>
              {cuisines.length > 0 && (
                <div className={styles.tagGroup}>
                  <span className={styles.tagLabel}>Cuisine</span>
                  <div className={styles.pills}>
                    {cuisines.map((c) => (
                      <span key={c} className={styles.pill}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {cook.niches.length > 0 && (
                <div className={styles.tagGroup}>
                  <span className={styles.tagLabel}>Specialties</span>
                  <div className={styles.pills}>
                    {cook.niches.map((c) => (
                      <span key={c} className={styles.pill}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {cook.dietaryTags.length > 0 && (
                <div className={styles.tagGroup}>
                  <span className={styles.tagLabel}>Dietary</span>
                  <div className={styles.pills}>
                    {cook.dietaryTags.map((c) => (
                      <span key={c} className={styles.pill}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className={styles.metaLine}>
            {formatMealsMade(cook.ordersCompleted)}
            {cook.memberSince ? ` · Member since ${cook.memberSince}` : ""}
          </p>

          <Link href={`/app/cooks/${id}/menu`} className={styles.orderBtn}>
            View menu
          </Link>
        </div>
      </header>

      {/* ── Bio ─────────────────────────────────────────────────────────── */}
      {cook.bio && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About</h2>
          <p className={styles.bio}>{cook.bio}</p>
        </section>
      )}

      {/* ── Availability ────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Availability</h2>
        <dl className={styles.facts}>
          {cook.leadTime && (
            <div className={styles.fact}>
              <dt>Order ahead</dt>
              <dd>
                {describeLeadTimePolicy(cook.leadTime, cook.leadTimeCutoff) ??
                  `${formatLeadTime(cook.leadTime)} notice`}
              </dd>
            </div>
          )}
          {pickupSummary && (
            <div className={styles.fact}>
              <dt>Pickup</dt>
              <dd>{pickupSummary}</dd>
            </div>
          )}
          {deliverySummary && (
            <div className={styles.fact}>
              <dt>Delivery</dt>
              <dd>{deliverySummary}</dd>
            </div>
          )}
          {orderSize && (
            <div className={styles.fact}>
              <dt>Order size</dt>
              <dd>{orderSize}</dd>
            </div>
          )}
          <div className={styles.fact}>
            <dt>Cancellations</dt>
            <dd>
              {describeCancellationPolicy(
                cook.cancellationAllowed,
                cook.leadTime,
                cook.leadTimeCutoff,
              )}
            </dd>
          </div>
          {!pickupSummary && !deliverySummary && (
            <div className={styles.fact}>
              <dt>Schedule</dt>
              <dd>No open times right now</dd>
            </div>
          )}
        </dl>
      </section>

      {/* ── Reviews ─────────────────────────────────────────────────────── */}
      <section id="reviews" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Reviews
          <span className={styles.sectionMeta}>
            <Star size={14} fill="currentColor" />
            {(cook.rating ?? 0).toFixed(1)} · {cook.reviewCount}
          </span>
        </h2>
        {reviews.length === 0 ? (
          <p className={styles.reviewsEmpty}>No reviews yet.</p>
        ) : (
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
                {review.comment && (
                  <p className={styles.reviewComment}>{review.comment}</p>
                )}
                {review.dishes.length > 0 && (
                  <span className={styles.reviewDish}>
                    Ordered: {review.dishes.join(", ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
