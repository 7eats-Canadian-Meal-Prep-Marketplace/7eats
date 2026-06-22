"use client";

import { Heart, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { unfollowCook } from "@/lib/favourites/follow-cook";
import { Skeleton } from "../_skeleton";
import styles from "./page.module.css";

type FavouriteCook = {
  id: string;
  name: string;
  photoUrl: string | null;
  neighborhood: string | null;
  pickupCity: string | null;
};

function cookInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function SavedPage() {
  const router = useRouter();
  const [cooks, setCooks] = useState<FavouriteCook[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadFavourites = useCallback(() => {
    setLoading(true);
    fetch("/api/favourites/cooks", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/app-auth/login?next=/app/saved");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (!json) return;
        setCooks(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => setCooks([]))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    loadFavourites();
  }, [loadFavourites]);

  async function handleUnfollow(cookId: string) {
    setRemovingId(cookId);
    const result = await unfollowCook(cookId);
    if (result === "auth") {
      router.push("/app-auth/login?next=/app/saved");
      return;
    }
    if (result === "ok") {
      setCooks((prev) => prev.filter((c) => c.id !== cookId));
    }
    setRemovingId(null);
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <h1 className={styles.heading}>Favourites</h1>
          <div className={styles.list}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.row} aria-hidden="true">
                <Skeleton circle width={56} height={56} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="55%" height={16} radius={6} />
                  <Skeleton
                    width="35%"
                    height={12}
                    radius={6}
                    style={{ marginTop: 8 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>Favourites</h1>
        <p className={styles.lead}>
          Kitchens you follow. Quick access when you&apos;re ready to order
          again.
        </p>

        {cooks.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Heart size={32} />
            </div>
            <h2 className={styles.emptyTitle}>No favourites yet</h2>
            <p className={styles.emptyDesc}>
              Follow cooks you love from their profile page and they&apos;ll
              show up here.
            </p>
            <Link href="/app/browse" className={styles.browseBtn}>
              Browse kitchens
            </Link>
          </div>
        ) : (
          <div className={styles.list}>
            {cooks.map((cook) => {
              const location = cook.pickupCity ?? cook.neighborhood;
              return (
                <div key={cook.id} className={styles.row}>
                  <Link
                    href={`/app/cooks/${cook.id}`}
                    className={styles.avatar}
                    aria-label={`View ${cook.name}`}
                  >
                    {cook.photoUrl ? (
                      // biome-ignore lint/performance/noImgElement: cook photo
                      <img src={cook.photoUrl} alt="" />
                    ) : (
                      cookInitials(cook.name)
                    )}
                  </Link>
                  <Link href={`/app/cooks/${cook.id}`} className={styles.info}>
                    <p className={styles.name}>{cook.name}</p>
                    {location && (
                      <p className={styles.meta}>
                        <MapPin size={13} aria-hidden />
                        {location}
                      </p>
                    )}
                  </Link>
                  <button
                    type="button"
                    className={styles.unfollowBtn}
                    aria-label={`Unfollow ${cook.name}`}
                    disabled={removingId === cook.id}
                    onClick={() => void handleUnfollow(cook.id)}
                  >
                    <Heart size={18} fill="currentColor" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
