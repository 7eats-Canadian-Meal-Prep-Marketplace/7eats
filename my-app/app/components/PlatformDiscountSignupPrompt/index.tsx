"use client";

import { ArrowRight, BadgePercent } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./PlatformDiscountSignupPrompt.module.css";

export type PlatformDiscountTeaserResponse = {
  available: boolean;
  name?: string;
  headline?: string;
  qualifier?: string | null;
  projectedAmount?: number;
};

export function usePlatformDiscountTeaser(
  enabled: boolean,
  subtotal?: number,
): PlatformDiscountTeaserResponse | null {
  const [teaser, setTeaser] = useState<PlatformDiscountTeaserResponse | null>(
    null,
  );

  useEffect(() => {
    if (!enabled) {
      setTeaser(null);
      return;
    }

    let cancelled = false;
    const params =
      subtotal != null && subtotal > 0
        ? `?subtotal=${encodeURIComponent(String(subtotal))}`
        : "";

    fetch(`/api/discounts/teaser${params}`)
      .then((r) => r.json())
      .then((json: PlatformDiscountTeaserResponse) => {
        if (!cancelled) setTeaser(json);
      })
      .catch(() => {
        if (!cancelled) setTeaser(null);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, subtotal]);

  return teaser;
}

type Props = {
  enabled: boolean;
  subtotal?: number;
  className?: string;
};

export default function PlatformDiscountSignupPrompt({
  enabled,
  subtotal,
  className,
}: Props) {
  const teaser = usePlatformDiscountTeaser(enabled, subtotal);

  if (!enabled || !teaser?.available || !teaser.headline) {
    return null;
  }

  return (
    <div className={`${styles.card} ${className ?? ""}`} role="note">
      <span className={styles.icon} aria-hidden="true">
        <BadgePercent size={20} strokeWidth={2} />
      </span>
      <div className={styles.body}>
        <p className={styles.headline}>{teaser.headline}</p>
        <p className={styles.subline}>
          {teaser.qualifier ?? "Members get this free"}
        </p>
      </div>
      <Link href="/app-auth/signup" className={styles.cta}>
        Sign up
        <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
      </Link>
    </div>
  );
}
