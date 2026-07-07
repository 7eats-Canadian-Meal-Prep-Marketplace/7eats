"use client";

import { Check, X } from "lucide-react";
import styles from "./RequirementsChecklist.module.css";

export type RequirementItem = { label: string; met: boolean };

/**
 * Live "what's needed to continue" list. Each rule turns green once met.
 * Rules stay neutral until `touched` so a fresh field doesn't look "wrong".
 */
export default function RequirementsChecklist({
  items,
  touched = true,
}: {
  items: RequirementItem[];
  touched?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <ul className={styles.list} aria-label="What's needed to continue">
      {items.map((item) => (
        <li
          key={item.label}
          className={`${styles.item} ${item.met ? styles.met : touched ? styles.unmet : ""}`}
        >
          <span className={styles.icon} aria-hidden="true">
            {item.met ? <Check size={13} /> : <X size={13} />}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
