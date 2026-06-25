import type { CSSProperties } from "react";
import styles from "./_skeleton.module.css";

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * A single shimmering placeholder block. Compose these to mirror the shape of
 * the content that is loading, so the transition to real data is calm rather
 * than a flash of "Loading…".
 */
export function Skeleton({
  width = "100%",
  height = 16,
  radius,
  circle = false,
  className,
  style,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`${styles.sk}${className ? ` ${className}` : ""}`}
      style={{
        width,
        height,
        borderRadius: circle ? "50%" : radius,
        ...style,
      }}
    />
  );
}
