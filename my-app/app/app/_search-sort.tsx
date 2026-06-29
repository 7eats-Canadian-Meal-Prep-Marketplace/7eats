"use client";

import { Check, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  COOK_SORT_OPTIONS,
  type CookSortKey,
  parseCookSort,
} from "@/lib/cooks/sort";
import styles from "./search/page.module.css";

export function SearchSortDropdown() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = parseCookSort(searchParams.get("sort"));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const activeLabel =
    COOK_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Closest";

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function pick(next: CookSortKey) {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "nearest") params.delete("sort");
    else params.set("sort", next);
    router.push(`/app/search?${params.toString()}`);
  }

  return (
    <div className={styles.sortWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.sortTrigger} ${open ? styles.sortTriggerOpen : ""}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        Sort: {activeLabel}
        <ChevronDown size={14} className={styles.sortChevron} aria-hidden />
      </button>
      {open && (
        <div className={styles.sortMenu} role="listbox" aria-label="Sort by">
          {COOK_SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={sort === opt.value}
              className={`${styles.sortOption} ${sort === opt.value ? styles.sortOptionActive : ""}`}
              onClick={() => pick(opt.value)}
            >
              {opt.label}
              {sort === opt.value && <Check size={14} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
