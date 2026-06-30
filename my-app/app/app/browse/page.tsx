"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "../_app-context";
import {
  type BrowseCookCard,
  CookGrid,
  normalizeBrowseCook,
} from "../_cook-card";
import { DiscoveryFilterBar } from "../_discovery-bar";
import { useServiceAddress } from "../_service-address-context";
import { Skeleton } from "../_skeleton";
import { BrowseEmpty } from "./_browse-empty";
import styles from "./page.module.css";

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

export default function BrowsePage() {
  const [cooks, setCooks] = useState<BrowseCookCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { ready, currentAddress, coordsKey } = useServiceAddress();
  const { fulfillment: fulfillmentMode } = useApp();
  const browseFetchKey = coordsKey ? `${coordsKey}|${fulfillmentMode}` : null;

  useEffect(() => {
    if (!ready) return;
    if (!currentAddress || !browseFetchKey) {
      setCooks([]);
      setLoading(false);
      return;
    }
    const mode = browseFetchKey.split("|")[1] as
      | "pickup"
      | "delivery"
      | undefined;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("lat", String(currentAddress.lat));
    params.set("lng", String(currentAddress.lng));
    params.set("mode", mode ?? "pickup");
    const url = `/api/cooks?${params.toString()}`;

    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const rows = Array.isArray(json.data) ? json.data : [];
        setCooks(
          rows.map((r: Record<string, unknown>) => normalizeBrowseCook(r)),
        );
      })
      .catch(() => setCooks([]))
      .finally(() => setLoading(false));
  }, [browseFetchKey, currentAddress, ready]);

  const nearYou = cooks;
  const lovedByNeighbours = [...cooks].sort(
    (a, b) =>
      (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount,
  );
  const freshPicks = [...cooks].reverse();

  return (
    <div className={styles.page}>
      <DiscoveryFilterBar />

      <div className={styles.desktopChipBar}>
        <div className={styles.filterInner}>
          <div className={styles.chipScroller}>
            {CUISINE_OPTIONS.map(({ label, value }) => (
              <Link
                key={label}
                href={
                  value === "all"
                    ? "/app/search?all=1"
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
          <BrowseEmpty address={currentAddress} />
        ) : (
          <>
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionHeadText}>
                  <h2 className={styles.sectionTitle}>
                    Meal prep services near you
                  </h2>
                  <p className={styles.sectionSub}>
                    Home cooks serving your neighbourhood
                  </p>
                </div>
              </div>
              <CookGrid cooks={nearYou} fulfillmentMode={fulfillmentMode} />
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionHeadText}>
                  <h2 className={styles.sectionTitle}>
                    Loved by your neighbours
                  </h2>
                  <p className={styles.sectionSub}>
                    The most-ordered meal prep services this week
                  </p>
                </div>
              </div>
              <CookGrid
                cooks={lovedByNeighbours}
                fulfillmentMode={fulfillmentMode}
              />
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionHeadText}>
                  <h2 className={styles.sectionTitle}>
                    Fresh picks for the week
                  </h2>
                  <p className={styles.sectionSub}>
                    New meal prep services to add to your rotation
                  </p>
                </div>
              </div>
              <CookGrid cooks={freshPicks} fulfillmentMode={fulfillmentMode} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
