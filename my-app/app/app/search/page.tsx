"use client";

import { Search, Star } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Skeleton } from "../_skeleton";
import styles from "../browse/page.module.css";

type CookCard = {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  bio: string | null;
  tags: { slug: string; label: string }[];
  pickupCity: string | null;
  rating: number | null;
  reviewCount: number;
  representativeDishPhoto: string | null;
  distanceKm: number | null;
};

function initials(name: string | null): string {
  if (!name) return "C";
  return name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function SearchContent() {
  const searchParams = useSearchParams();
  const cuisineParam = searchParams.get("cuisine") ?? "";

  const [cooks, setCooks] = useState<CookCard[]>([]);
  const [query, setQuery] = useState(cuisineParam);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cooks", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setCooks(Array.isArray(json.data) ? json.data : []))
      .catch(() => setCooks([]))
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cooks;
    return cooks.filter((c) => {
      const hay = [
        c.displayName ?? "",
        c.pickupCity ?? "",
        c.bio ?? "",
        ...c.tags.map((t) => t.label),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [cooks, query]);

  return (
    <div className={styles.page}>
      <div className={styles.filterBar}>
        <div className={styles.filterInner}>
          <label
            className={styles.chipScroller}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
            }}
          >
            <Search size={18} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search kitchens, cuisines, cities…"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                font: "inherit",
                background: "transparent",
              }}
            />
          </label>
        </div>
      </div>

      <div className={styles.content}>
        {loading ? (
          <section className={styles.section}>
            <div className={styles.grid}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={styles.card} aria-hidden="true">
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
        ) : results.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No kitchens found</p>
            <p className={styles.emptyDesc}>Try a different search.</p>
          </div>
        ) : (
          <section className={styles.section}>
            <div className={styles.grid}>
              {results.map((cook) => (
                <Link
                  key={cook.id}
                  href={`/app/cooks/${cook.id}/menu`}
                  className={styles.card}
                >
                  <div className={styles.cardCover}>
                    {cook.representativeDishPhoto ? (
                      // biome-ignore lint/performance/noImgElement: cover
                      <img
                        src={cook.representativeDishPhoto}
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
                      {cook.displayName ?? "Chef"}
                    </h3>
                    <p className={styles.metaLine}>{cook.pickupCity ?? ""}</p>
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
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
