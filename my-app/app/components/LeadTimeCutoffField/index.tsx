"use client";

import { useMemo } from "react";
import {
  DEFAULT_LEAD_TIME_CUTOFF,
  formatLeadTimeCutoffLabel,
  LEAD_TIME_CUTOFF_PRESETS,
  leadTimeExampleText,
  normalizeLeadTimeCutoff,
} from "@/lib/lead-time";
import styles from "./LeadTimeCutoffField.module.css";

type Props = {
  value: string;
  leadTime: string;
  onChange: (value: string) => void;
  hintClassName?: string;
  labelClassName?: string;
  groupClassName?: string;
};

export default function LeadTimeCutoffField({
  value,
  leadTime,
  onChange,
  hintClassName,
  labelClassName,
  groupClassName,
}: Props) {
  const normalized = normalizeLeadTimeCutoff(value || DEFAULT_LEAD_TIME_CUTOFF);
  const example =
    leadTime !== ""
      ? leadTimeExampleText(leadTime, normalized)
      : "Choose a lead time to see an example.";

  const options = useMemo(() => {
    const presets = [...LEAD_TIME_CUTOFF_PRESETS];
    if (!presets.some((preset) => preset.value === normalized)) {
      presets.unshift({
        value: normalized,
        label: formatLeadTimeCutoffLabel(normalized),
      });
    }
    return presets;
  }, [normalized]);

  return (
    <div className={styles.wrap}>
      <label
        className={labelClassName ?? styles.label}
        htmlFor="lead-time-cutoff"
      >
        Order cutoff time
      </label>
      <select
        id="lead-time-cutoff"
        className={groupClassName ?? styles.select}
        value={normalized}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
      <p className={hintClassName ?? styles.hint}>
        Orders for a pickup day close at this time on the order-by day. Midnight
        is the default.
      </p>
      <p className={styles.example}>{example}</p>
    </div>
  );
}
