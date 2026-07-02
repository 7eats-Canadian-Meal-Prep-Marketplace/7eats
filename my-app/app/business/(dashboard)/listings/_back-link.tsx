"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import styles from "./_back-link.module.css";

export function BackToListings() {
  return (
    <Link href="/business/listings" className={styles.back}>
      <ChevronLeft size={14} strokeWidth={2.5} />
      Listings
    </Link>
  );
}

export function BackToDishes() {
  return (
    <Link href="/business/listings" className={styles.back}>
      <ChevronLeft size={14} strokeWidth={2.5} />
      Dishes
    </Link>
  );
}
