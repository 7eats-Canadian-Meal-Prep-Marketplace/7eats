"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { parseCookSort, sortCooks } from "@/lib/cook-sort";
import { useApp } from "../_app-context";
import {
  type BrowseCookCard,
  CookGrid,
  normalizeBrowseCook,
} from "../_cook-card";
import { SearchSortDropdown } from "../_search-sort";
import { useServiceAddress } from "../_service-address-context";
import { Skeleton } from "../_skeleton";
import browseStyles from "../browse/page.module.css";
import searchStyles from "./page.module.css";

function matchesQuery(cook: BrowseCookCard, q: string): boolean {
  const hay = [
    cook.displayName ?? "",
    cook.cookName ?? "",
    cook.pickupCity ?? "",
    cook.bio ?? "",
    ...cook.tags.map((t) => t.label),
    ...cook.niches.map((t) => t.label),
    ...cook.cuisines.map((t) => t.label),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function matchesCuisine(cook: BrowseCookCard, cuisine: string): boolean {
  const needle = cuisine.toLowerCase();
  return (
    cook.cuisines.some((t) => t.label.toLowerCase().includes(needle)) ||
    cook.tags.some((t) => t.label.toLowerCase().includes(needle))
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const cuisineParam = searchParams.get("cuisine") ?? "";
  const sortKey = parseCookSort(searchParams.get("sort"));

  const [cooks, setCooks] = useState<BrowseCookCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { ready, currentAddress, coordsKey } = useServiceAddress();
  const { fulfillment: fulfillmentMode } = useApp();

  useEffect(() => {
    if (!ready) return;
    if (!currentAddress || !coordsKey) {
      setCooks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("lat", String(currentAddress.lat));
    params.set("lng", String(currentAddress.lng));
    fetch(`/api/cooks?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const rows = Array.isArray(json.data) ? json.data : [];
        setCooks(
          rows.map((r: Record<string, unknown>) => normalizeBrowseCook(r)),
        );
      })
      .catch(() => setCooks([]))
      .finally(() => setLoading(false));
  }, [coordsKey, currentAddress, ready]);

  const results = useMemo(() => {
    let list = cooks;
    const q = qParam.trim().toLowerCase();
    if (q) list = list.filter((c) => matchesQuery(c, q));
    const cuisine = cuisineParam.trim();
    if (cuisine && cuisine.toLowerCase() !== "all") {
      list = list.filter((c) => matchesCuisine(c, cuisine));
    }
    return sortCooks(list, sortKey, fulfillmentMode);
  }, [cooks, qParam, cuisineParam, sortKey, fulfillmentMode]);

  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    const q = qParam.trim();
    const cuisine = cuisineParam.trim();
    if (q) parts.push(`matching “${q}”`);
    if (cuisine && cuisine.toLowerCase() !== "all") parts.push(cuisine);
    return parts.join(" · ");
  }, [qParam, cuisineParam]);

  const hasFilter = filterLabel.length > 0;

  return (
    <div className={browseStyles.page}>
      <div className={browseStyles.content}>
        {hasFilter && !loading && (
          <p className={browseStyles.searchSummary}>{filterLabel}</p>
        )}

        {!loading && results.length > 0 && (
          <div className={searchStyles.resultsBar}>
            <p className={searchStyles.resultCount}>
              {results.length} kitchen{results.length === 1 ? "" : "s"}
            </p>
            <SearchSortDropdown />
          </div>
        )}

        {loading ? (
          <section className={browseStyles.section}>
            <div className={browseStyles.grid}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={browseStyles.card} aria-hidden="true">
                  <div className={browseStyles.cardCover}>
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
          <div className={browseStyles.emptyState}>
            <p className={browseStyles.emptyTitle}>No kitchens found</p>
            <p className={browseStyles.emptyDesc}>
              Try a different search in the bar above.
            </p>
          </div>
        ) : (
          <section className={browseStyles.section}>
            <CookGrid cooks={results} fulfillmentMode={fulfillmentMode} />
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
