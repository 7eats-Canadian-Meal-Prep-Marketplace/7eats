import { Skeleton } from "../../../_skeleton";
import styles from "./page.module.css";

// Loading placeholder for the dish detail page. Mirrors the Details tab's
// footprint — tab row, stats strip, details card, photos card — so opening a
// dish settles into real data instead of flashing "Loading dish…".
export function DishDetailSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.tabRow} aria-hidden="true">
        <div className={styles.tab}>
          <Skeleton width={48} height={14} radius={6} />
        </div>
        <div className={styles.tab}>
          <Skeleton width={64} height={14} radius={6} />
        </div>
        <div className={styles.tab}>
          <Skeleton width={76} height={14} radius={6} />
        </div>
      </div>

      <div className={styles.detailsTab}>
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <Skeleton width={72} height={10} radius={5} />
            <Skeleton width={36} height={22} radius={6} />
          </div>
          <div className={styles.statCard}>
            <Skeleton width={88} height={10} radius={5} />
            <Skeleton width={36} height={22} radius={6} />
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <Skeleton width={96} height={14} radius={6} />
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <Skeleton width="42%" height={12} radius={6} />
              <Skeleton width="100%" height={38} radius={8} />
            </div>
            <div className={styles.formGroup}>
              <Skeleton width="42%" height={12} radius={6} />
              <Skeleton width="100%" height={38} radius={8} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <Skeleton width="30%" height={12} radius={6} />
            <Skeleton width="100%" height={92} radius={8} />
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <Skeleton width={72} height={14} radius={6} />
            <Skeleton width="55%" height={11} radius={6} />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Skeleton width={104} height={104} radius={10} />
            <Skeleton width={104} height={104} radius={10} />
            <Skeleton width={104} height={104} radius={10} />
          </div>
        </div>
      </div>
    </div>
  );
}
