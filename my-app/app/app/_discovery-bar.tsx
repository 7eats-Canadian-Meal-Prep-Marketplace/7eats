"use client";

import { Suspense } from "react";
import { AppSearchInput } from "./_app-search";
import styles from "./_discovery-bar.module.css";
import { FulfillmentToggle } from "./_shell";
import shellStyles from "./_shell.module.css";

export function DiscoveryFilterBar({
  showMobileSearch = false,
}: {
  showMobileSearch?: boolean;
}) {
  return (
    <div className={styles.filterBar}>
      <div
        className={`${styles.filterInner} ${showMobileSearch ? styles.filterInnerSearch : ""}`}
      >
        <div className={styles.toggleWrap}>
          <FulfillmentToggle className={shellStyles.segmentedWide} />
        </div>
        {showMobileSearch && (
          <Suspense fallback={null}>
            <AppSearchInput variant="page" />
          </Suspense>
        )}
      </div>
    </div>
  );
}
