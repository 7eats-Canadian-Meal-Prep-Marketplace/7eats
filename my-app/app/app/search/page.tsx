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

function SearchContent() {
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const cuisineParam = searchParams.get("cuisine") ?? "";
  const sortParam = searchParams.get("sort");
  const sortKey = parseCookSort(sortParam);

  const [cooks, setCooks] = useState<BrowseCookCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { ready, currentAddress, coordsKey } = useServiceAddress();
  const { fulfillment: fulfillmentMode } = useApp();

  // The effective query: explicit search text, else a cuisine chip.
  const effectiveQuery = useMemo(() => {
    const q = qParam.trim();
    if (q) return q;
    const cuisine = cuisineParam.trim();
    if (cuisine && cuisine.toLowerCase() !== "all") return cuisine;
    return "";
  }, [qParam, cuisineParam]);

  useEffect(() => {
    if (!ready) return;
    if (!currentAddress || !coordsKey || !effectiveQuery) {
      setCooks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const params = new URLSearchParams({
      q: effectiveQuery,
      lat: String(currentAddress.lat),
      lng: String(currentAddress.lng),
      mode: fulfillmentMode,
    });
    fetch(`/api/search?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        const rows = Array.isArray(json.data) ? json.data : [];
        setCooks(
          rows.map((r: Record<string, unknown>) => normalizeBrowseCook(r)),
        );
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setCooks([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [coordsKey, currentAddress, ready, effectiveQuery, fulfillmentMode]);

  const results = useMemo(() => {
    // Default order is the server's relevance ranking. Only re-order when the
    // user explicitly picks a sort from the dropdown.
    if (!sortParam) return cooks;
    return sortCooks(cooks, sortKey, fulfillmentMode);
  }, [cooks, sortParam, sortKey, fulfillmentMode]);

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
        ) : !effectiveQuery ? (
          <div className={browseStyles.emptyState}>
            <p className={browseStyles.emptyTitle}>Search for a craving</p>
            <p className={browseStyles.emptyDesc}>
              Try a dish, cuisine, or kitchen name in the bar above.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className={browseStyles.emptyState}>
            <p className={browseStyles.emptyTitle}>No kitchens found</p>
            <p className={browseStyles.emptyDesc}>
              Nothing nearby matches “{effectiveQuery}”. Try another search.
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
