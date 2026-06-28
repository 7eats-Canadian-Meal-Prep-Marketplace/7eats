"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useApp } from "./_app-context";
import styles from "./_app-search.module.css";
import { useServiceAddress } from "./_service-address-context";

type SuggestKitchen = {
  id: string;
  name: string;
  cuisines: string[];
  photoUrl: string | null;
  distanceKm: number | null;
};

type SuggestItem =
  | { kind: "term"; value: string }
  | { kind: "kitchen"; kitchen: SuggestKitchen };

export function AppSearchInput({
  variant = "header",
}: {
  variant?: "header" | "page";
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentAddress } = useServiceAddress();
  const { fulfillment } = useApp();
  const [val, setVal] = useState(searchParams.get("q") ?? "");
  const [terms, setTerms] = useState<string[]>([]);
  const [kitchens, setKitchens] = useState<SuggestKitchen[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const debounced = useDebounce(val.trim(), 200);

  useEffect(() => {
    setVal(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (debounced.length < 2 || !currentAddress) {
      setTerms([]);
      setKitchens([]);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      q: debounced,
      lat: String(currentAddress.lat),
      lng: String(currentAddress.lng),
      mode: fulfillment,
    });
    fetch(`/api/search/suggest?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        const data = json?.data ?? {};
        setTerms(Array.isArray(data.terms) ? data.terms : []);
        setKitchens(Array.isArray(data.kitchens) ? data.kitchens : []);
        setActiveIndex(-1);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setTerms([]);
          setKitchens([]);
        }
      });
    return () => controller.abort();
  }, [debounced, currentAddress, fulfillment]);

  const items: SuggestItem[] = [
    ...terms.map((t) => ({ kind: "term" as const, value: t })),
    ...kitchens.map((k) => ({ kind: "kitchen" as const, kitchen: k })),
  ];
  const showDropdown = open && val.trim().length >= 2 && items.length > 0;

  useEffect(() => {
    if (!showDropdown) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showDropdown]);

  function pushSearch(q: string) {
    const params = new URLSearchParams();
    const trimmed = q.trim();
    if (trimmed) params.set("q", trimmed);
    else params.set("all", "1");
    const sort = searchParams.get("sort");
    if (sort && sort !== "nearest") params.set("sort", sort);
    const qs = params.toString();
    setOpen(false);
    router.push(`/app/search?${qs}`);
  }

  function selectItem(item: SuggestItem) {
    if (item.kind === "term") {
      setVal(item.value);
      pushSearch(item.value);
    } else {
      setOpen(false);
      router.push(`/app/cooks/${item.kitchen.id}/menu`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < items.length) {
        e.preventDefault();
        selectItem(items[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const wrapClass =
    variant === "page" ? styles.pageSearchWrap : styles.headerSearchWrap;

  return (
    <div className={wrapClass} ref={wrapRef}>
      <form
        className={variant === "page" ? styles.pageSearch : styles.headerSearch}
        onSubmit={(e) => {
          e.preventDefault();
          pushSearch(val);
        }}
      >
        <Search
          size={variant === "page" ? 18 : 16}
          className={styles.searchIcon}
        />
        <input
          className={styles.searchInput}
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search cooks, dishes, cuisines…"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="app-search-suggest-list"
        />
      </form>

      {showDropdown && (
        <div
          id="app-search-suggest-list"
          className={styles.suggestMenu}
          role="listbox"
        >
          {terms.length > 0 && (
            <div className={styles.suggestSection}>
              {terms.map((t, i) => (
                <button
                  key={`term-${t}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === i}
                  className={`${styles.suggestTerm} ${activeIndex === i ? styles.suggestActive : ""}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => selectItem({ kind: "term", value: t })}
                >
                  <Search size={13} className={styles.suggestTermIcon} />
                  {t}
                </button>
              ))}
            </div>
          )}
          {kitchens.length > 0 && (
            <div className={styles.suggestSection}>
              {kitchens.map((k, i) => {
                const idx = terms.length + i;
                return (
                  <button
                    key={`kitchen-${k.id}`}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === idx}
                    className={`${styles.suggestKitchen} ${activeIndex === idx ? styles.suggestActive : ""}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectItem({ kind: "kitchen", kitchen: k })}
                  >
                    <span className={styles.suggestThumb}>
                      {k.photoUrl ? (
                        <Image
                          src={k.photoUrl}
                          alt=""
                          fill
                          className={styles.suggestThumbImg}
                          sizes="40px"
                        />
                      ) : null}
                    </span>
                    <span className={styles.suggestKitchenText}>
                      <span className={styles.suggestKitchenName}>
                        {k.name}
                      </span>
                      {(k.cuisines.length > 0 || k.distanceKm != null) && (
                        <span className={styles.suggestKitchenMeta}>
                          {[
                            k.cuisines.slice(0, 2).join(" · "),
                            k.distanceKm != null ? `${k.distanceKm} km` : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
