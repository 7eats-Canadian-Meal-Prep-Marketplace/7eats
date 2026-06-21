"use client";

import { MapPin } from "lucide-react";
import { openAddressEditor } from "@/lib/address-events";
import { classifyRegion } from "@/lib/service-areas";
import type { NormalizedAddress } from "@/lib/types/address";
import styles from "./page.module.css";

/**
 * Location-aware empty state for browse. When no reachable kitchens turn up, we
 * read the service address and tell the user where 7eats stands relative to it:
 * coming soon to their Ontario city, coming soon to their province, or Canada-
 * only. The pulsing radar emblem reads as "coverage expanding toward you".
 */
export function BrowseEmpty({
  address,
}: {
  address: NormalizedAddress | null;
}) {
  const region = address ? classifyRegion(address) : null;

  let title: string;
  let desc = "";

  if (region?.kind === "active-province") {
    title = `7eats is coming to ${region.place} soon`;
  } else if (region?.kind === "other-province") {
    title = `7eats is coming to ${region.place} soon`;
    desc = `We're not in ${region.place} yet. We're expanding across Canada one neighbourhood at a time, so check back soon or try another address.`;
  } else if (region?.kind === "outside-canada") {
    title = "7eats is Canada-only for now";
    desc =
      "We're serving home-cooked meals across Canada. Enter a Canadian address to start exploring meal prep services near you.";
  } else {
    title = "No meal prep services nearby yet";
    desc = "Try another address to find home cooks near you.";
  }

  return (
    <div className={styles.comingSoon}>
      <div className={styles.radar} aria-hidden="true">
        <span className={styles.radarRing} />
        <span className={styles.radarRing} />
        <span className={styles.radarRing} />
        <span className={styles.radarPin}>
          <MapPin size={26} strokeWidth={2.5} />
        </span>
      </div>
      <h2 className={styles.comingSoonTitle}>{title}</h2>
      {desc && <p className={styles.comingSoonDesc}>{desc}</p>}
      <button
        type="button"
        className={styles.comingSoonBtn}
        onClick={openAddressEditor}
      >
        Try another address
      </button>
    </div>
  );
}
