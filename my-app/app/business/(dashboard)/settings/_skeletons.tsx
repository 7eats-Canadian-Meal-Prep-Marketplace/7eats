import { Skeleton } from "../_skeleton";
import styles from "./page.module.css";

// Loading placeholders for the settings cards. Each mirrors the real card's
// shape (label + input rows, or label + toggle rows) so a section keeps its
// footprint while its data loads instead of flashing "Loading…".

function FieldSkeleton() {
  return (
    <div className={styles.formGroup} aria-hidden="true">
      <Skeleton width="28%" height={12} radius={6} />
      <Skeleton width="100%" height={38} radius={8} />
    </div>
  );
}

export function CardFormSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardForm}>
        {Array.from({ length: rows }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: loading skeleton only
          <FieldSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function NotifRowsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className={styles.card}>
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: loading skeleton only
        <div key={i} className={styles.notifRow} aria-hidden="true">
          <div
            className={styles.notifInfo}
            style={{ display: "flex", flexDirection: "column", gap: 7 }}
          >
            <Skeleton width={160} height={13} radius={6} />
            <Skeleton width={240} height={11} radius={6} />
          </div>
          <Skeleton width={44} height={26} radius={13} />
        </div>
      ))}
    </div>
  );
}
