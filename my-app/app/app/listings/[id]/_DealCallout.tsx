import type { MockListingDeal } from "../../_mock";
import styles from "./_DealCallout.module.css";
import { getDealConditions } from "./_listing-deal";

export function DealCallout({ deal }: { deal: MockListingDeal }) {
  const conditions = getDealConditions(deal);

  return (
    <div className={styles.callout}>
      <p className={styles.badge}>{deal.badge}</p>
      {conditions.length > 0 && (
        <p className={styles.meta}>
          {conditions.map((text, index) => (
            <span key={text} className={styles.metaItem}>
              {index > 0 && (
                <span className={styles.sep} aria-hidden>
                  ·
                </span>
              )}
              {text}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
