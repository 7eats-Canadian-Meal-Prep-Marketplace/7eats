"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  cookPersonName,
  kitchenDisplayName,
  shouldShowKitchenSubtitle,
} from "@/lib/cook-display";
import { useApp } from "../_app-context";
import { FulfillmentToggle } from "../_shell";
import { Skeleton } from "../_skeleton";
import { AddressBar } from "./_address-bar";
import styles from "./page.module.css";

type CookCard = {
  id: string;
  displayName: string | null;
  cookName: string | null;
  photoUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  tags: { slug: string; label: string }[];
  leadTime: string | null;
  delivery: "none" | "self" | null;
  pickupCity: string | null;
  rating: number | null;
  reviewCount: number;
  representativeDishPhoto: string | null;
  distanceKm: number | null;
};

const CUISINE_OPTIONS = [
  { label: "Search all", value: "all" },
  { label: "West African", value: "West African" },
  { label: "Korean", value: "Korean" },
  { label: "Middle Eastern", value: "Middle Eastern" },
  { label: "Brazilian", value: "Brazilian" },
  { label: "Italian", value: "Italian" },
  { label: "Caribbean", value: "Caribbean" },
  { label: "Japanese", value: "Japanese" },
  { label: "South Asian", value: "South Asian" },
];

function initials(name: string | null): string {
  if (!name) return "C";
  return name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function BrowsePage() {
  const { isLoggedIn } = useApp();
  const [cooks, setCooks] = useState<CookCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    fetch(`${baseUrl}/api/cooks`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setCooks(Array.isArray(json.data) ? json.data : []))
      .catch(() => setCooks([]))
      .finally(() => setLoading(false));
  }, []);

  const featured = cooks.slice(0, 8);

  return (
    <div className={styles.page}>
      <AddressBar isLoggedIn={isLoggedIn} />

      <div className={styles.filterBar}>
        <div className={styles.filterInner}>
          <div className={styles.mobileToggle}>
            <FulfillmentToggle />
          </div>
          <div className={styles.chipScroller}>
            {CUISINE_OPTIONS.map(({ label, value }) => (
              <Link
                key={value}
                href={
                  value === "all"
                    ? "/app/search"
                    : `/app/search?cuisine=${encodeURIComponent(value)}`
                }
                className={styles.chip}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {loading ? (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionHeadText}>
                <Skeleton width={160} height={20} radius={6} />
                <Skeleton
                  width={220}
                  height={13}
                  radius={6}
                  style={{ marginTop: 8 }}
                />
              </div>
            </div>
            <div className={styles.grid}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={styles.card}>
                  <div className={styles.cardCover}>
                    <Skeleton
                      style={{ position: "absolute", inset: 0 }}
                      radius={0}
                    />
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <Skeleton width="70%" height={15} radius={6} />
                    <Skeleton
                      width="45%"
                      height={12}
                      radius={6}
                      style={{ marginTop: 8 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : cooks.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No cooks nearby yet</p>
            <p className={styles.emptyDesc}>Check back soon.</p>
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <div className={styles.sectionHeadText}>
                    <h2 className={styles.sectionTitle}>Cooks spotlight</h2>
                    <p className={styles.sectionSub}>
                      The home chefs your neighbours are loving
                    </p>
                  </div>
                </div>
                <div className={styles.strip}>
                  {featured.map((cook) => (
                    <Link
                      key={cook.id}
                      href={`/app/cooks/${cook.id}`}
                      className={styles.cookCard}
                    >
                      <div className={styles.cookAvatarLg}>
                        {cook.photoUrl ? (
                          // biome-ignore lint/performance/noImgElement: avatar
                          <img
                            src={cook.photoUrl}
                            alt=""
                            className={styles.cookAvatarImg}
                          />
                        ) : (
                          initials(cook.cookName ?? cook.displayName)
                        )}
                      </div>
                      <span className={styles.cookCardName}>
                        {cookPersonName(cook)}
                      </span>
                      {shouldShowKitchenSubtitle(cook) && (
                        <span className={styles.cookCardCuisine}>
                          {kitchenDisplayName(cook)}
                        </span>
                      )}
                      {cook.pickupCity && !shouldShowKitchenSubtitle(cook) && (
                        <span className={styles.cookCardCuisine}>
                          {cook.pickupCity}
                        </span>
                      )}
                      {cook.rating != null && (
                        <span className={styles.cookCardRating}>
                          <Star size={11} fill="currentColor" />
                          {cook.rating.toFixed(1)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionHeadText}>
                  <h2 className={styles.sectionTitle}>All kitchens</h2>
                  <p className={styles.sectionSub}>
                    Tap a kitchen to see their menu
                  </p>
                </div>
              </div>
              <div className={styles.grid}>
                {cooks.map((cook) => (
                  <Link
                    key={cook.id}
                    href={`/app/cooks/${cook.id}/menu`}
                    className={styles.card}
                  >
                    <div className={styles.cardCover}>
                      {cook.bannerUrl || cook.representativeDishPhoto ? (
                        // biome-ignore lint/performance/noImgElement: cover
                        <img
                          src={
                            cook.bannerUrl ??
                            cook.representativeDishPhoto ??
                            undefined
                          }
                          alt=""
                          className={styles.cardImage}
                        />
                      ) : (
                        <div className={styles.cardCoverPlaceholder} />
                      )}
                      <div className={styles.cardAvatar}>
                        {cook.photoUrl ? (
                          // biome-ignore lint/performance/noImgElement: avatar
                          <img
                            src={cook.photoUrl}
                            alt=""
                            className={styles.cookAvatarImg}
                          />
                        ) : (
                          initials(cook.displayName)
                        )}
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <h3 className={styles.cardTitle}>
                        {kitchenDisplayName(cook)}
                      </h3>
                      <p className={styles.metaLine}>
                        {cook.pickupCity ?? ""}
                        {cook.distanceKm != null
                          ? ` · ${cook.distanceKm} km`
                          : ""}
                      </p>
                      {cook.tags.length > 0 && (
                        <p className={styles.metaLine}>
                          {cook.tags
                            .slice(0, 3)
                            .map((t) => t.label)
                            .join(" · ")}
                        </p>
                      )}
                      {cook.rating != null && (
                        <p className={styles.metaLine}>
                          <Star size={12} fill="currentColor" /> {cook.rating} (
                          {cook.reviewCount})
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
