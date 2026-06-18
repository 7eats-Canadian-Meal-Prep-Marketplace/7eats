"use client";

import { Plus, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";

type DishStatus = "draft" | "active" | "archived";

type Dish = {
  id: string;
  name: string;
  price: string;
  cuisine: string | null;
  status: DishStatus;
};

const FILTERS: { value: DishStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
];

function StatusPill({ status }: { status: DishStatus }) {
  const dotCls =
    status === "active"
      ? styles.dotActive
      : status === "draft"
        ? styles.dotDraft
        : styles.dotArchived;
  const label =
    status === "active" ? "Active" : status === "draft" ? "Draft" : "Archived";
  return (
    <span className={styles.imgPill}>
      <span className={`${styles.pillDot} ${dotCls}`} />
      {label}
    </span>
  );
}

export default function MealsPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [filter, setFilter] = useState<DishStatus>("active");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/business/dishes?status=${filter}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setDishes(Array.isArray(json.data) ? json.data : []))
      .catch(() => setDishes([]))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.toolbar}>
          <div className={styles.filterGroup}>
            {FILTERS.map((f) => (
              <button
                type="button"
                key={f.value}
                className={`${styles.filterBtn} ${filter === f.value ? styles.filterBtnActive : ""}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Link href="/business/listings/dishes/new" className={styles.newBtn}>
            <Plus size={16} /> New meal
          </Link>
        </div>

        {loading ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Loading meals…</p>
          </div>
        ) : dishes.length === 0 ? (
          <div className={styles.empty}>
            <UtensilsCrossed
              size={40}
              className={styles.emptyIcon}
              aria-hidden
            />
            <p className={styles.emptyTitle}>No {filter} meals</p>
            <p className={styles.emptyDesc}>
              Create a meal to start taking orders.
            </p>
            <Link
              href="/business/listings/dishes/new"
              className={styles.emptyBtn}
            >
              <Plus size={16} /> New meal
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {dishes.map((dish) => (
              <Link
                key={dish.id}
                href={`/business/listings/dishes/${dish.id}`}
                className={styles.card}
              >
                <div className={styles.cardImg}>
                  <StatusPill status={dish.status} />
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{dish.name}</h3>
                  {dish.cuisine && (
                    <p className={styles.cardSub}>{dish.cuisine}</p>
                  )}
                  <p className={styles.priceTag}>
                    <span className={styles.priceTagCurr}>$</span>
                    {Number(dish.price).toFixed(2)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
