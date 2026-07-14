"use client";

import { MoreHorizontal, Plus, Utensils } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { openOrdersArchiveError } from "@/lib/dishes/lifecycle-messages";
import { mealToastError, mealToastSuccess } from "@/lib/meal-toast";
import { ConfirmDialog } from "../_components/ConfirmDialog";
import { Skeleton } from "../_skeleton";
import styles from "./page.module.css";

type DishStatus = "active" | "inactive" | "draft";

type Dish = {
  id: string;
  name: string;
  price: string;
  status: DishStatus;
  totalOrders: number;
  canDelete: boolean;
};

const FILTERS: { value: DishStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "draft", label: "Drafts" },
];

function statusFromSearch(search: string): DishStatus {
  const raw = new URLSearchParams(search).get("status");
  if (raw === "draft" || raw === "inactive" || raw === "active") return raw;
  return "active";
}

function StatusPill({ status }: { status: DishStatus }) {
  const dotCls =
    status === "active"
      ? styles.dotActive
      : status === "draft"
        ? styles.dotDraft
        : styles.dotInactive;
  const label =
    status === "active" ? "Active" : status === "draft" ? "Draft" : "Inactive";
  return (
    <span
      className={`${styles.statusBadge} ${status === "draft" ? styles.statusBadgeDraft : ""}`}
    >
      <span className={`${styles.pillDot} ${dotCls}`} />
      {label}
    </span>
  );
}

function DishMenu({ dish, onChanged }: { dish: Dish; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveWarning, setArchiveWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function runUnarchive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/business/dishes/${dish.id}/unarchive`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        mealToastError(data.error ?? "Action failed.");
        return;
      }
      mealToastSuccess("Meal is active again");
      onChanged();
    } catch {
      mealToastError("Something went wrong.");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  async function openArchiveConfirm() {
    setOpen(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/business/dishes/${dish.id}`);
      const data = await res.json();
      if (!res.ok) {
        mealToastError(data.error ?? "Could not load meal details.");
        return;
      }

      const stats = data.data?.stats as
        | {
            openOrderCount?: number;
            isLastActiveDish?: boolean;
          }
        | undefined;

      const openOrderCount = stats?.openOrderCount ?? 0;
      if (openOrderCount > 0) {
        mealToastError(openOrdersArchiveError(openOrderCount));
        return;
      }

      setArchiveWarning(
        stats?.isLastActiveDish
          ? "This is your only active meal. You will be hidden from browse and search until another meal is active."
          : null,
      );
      setArchiveOpen(true);
    } catch {
      mealToastError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmArchive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/business/dishes/${dish.id}/archive`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        mealToastError(data.error ?? "Could not pause meal.");
        return;
      }
      mealToastSuccess(
        data.hiddenFromBrowse
          ? "Meal paused. Activate another meal to appear in search again."
          : "Meal paused",
      );
      onChanged();
      setArchiveOpen(false);
    } catch {
      mealToastError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/business/dishes/${dish.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        mealToastError(data.error ?? "Could not delete meal.");
        return;
      }
      mealToastSuccess("Meal deleted");
      onChanged();
      setDeleteOpen(false);
    } catch {
      mealToastError("Something went wrong.");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const archiveMessage =
    "It will stop appearing on your menu for new orders. You can activate it again anytime.";

  return (
    <div className={styles.menuWrap} ref={ref}>
      <button
        type="button"
        className={styles.menuBtn}
        aria-label="Meal options"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className={styles.menuDropdown}>
          {dish.status === "active" && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                void openArchiveConfirm();
              }}
            >
              Pause meal
            </button>
          )}
          {dish.status === "inactive" && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                void runUnarchive();
              }}
            >
              Activate
            </button>
          )}
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDanger}${dish.status === "draft" ? ` ${styles.menuItemDangerOnly}` : ""}`}
            disabled={!dish.canDelete}
            title={
              dish.canDelete
                ? undefined
                : "Meals with order history must be paused, not deleted."
            }
            onClick={(e) => {
              e.stopPropagation();
              if (!dish.canDelete) return;
              setOpen(false);
              setDeleteOpen(true);
            }}
          >
            Delete
          </button>
        </div>
      )}
      <ConfirmDialog
        open={archiveOpen}
        title={`Pause "${dish.name}"?`}
        message={archiveMessage}
        callout={archiveWarning ?? undefined}
        confirmLabel="Pause meal"
        cancelLabel="Keep active"
        busy={busy}
        onConfirm={() => void confirmArchive()}
        onCancel={() => {
          if (!busy) setArchiveOpen(false);
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={`Delete "${dish.name}"?`}
        message="This permanently removes the meal from your menu. Only use this for meals that were never ordered. If customers have ordered it before, pause it instead."
        confirmLabel="Delete meal"
        cancelLabel="Keep meal"
        danger
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!busy) setDeleteOpen(false);
        }}
      />
    </div>
  );
}

function mapDishRow(
  row: Dish & { totalOrders?: number; canDelete?: boolean },
): Dish {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    status: row.status,
    totalOrders: row.totalOrders ?? 0,
    canDelete:
      row.status === "draft"
        ? true
        : (row.canDelete ?? (row.totalOrders ?? 0) === 0),
  };
}

export default function MealsPage() {
  const router = useRouter();
  // null until we read ?status= — avoids fetching Active first and overwriting Drafts.
  const [filter, setFilter] = useState<DishStatus | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const loadGen = useRef(0);
  const filterRef = useRef<DishStatus | null>(null);

  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    setFilter(statusFromSearch(window.location.search));
  }, []);

  const selectFilter = useCallback(
    (next: DishStatus) => {
      setFilter(next);
      const url =
        next === "active"
          ? "/business/listings"
          : `/business/listings?status=${next}`;
      router.replace(url, { scroll: false });
    },
    [router],
  );

  const loadDishes = useCallback(async (status: DishStatus) => {
    const gen = ++loadGen.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/business/dishes?status=${status}`);
      const json = res.ok ? await res.json() : { data: [] };
      if (gen !== loadGen.current) return;
      setDishes(
        Array.isArray(json.data)
          ? json.data.map(
              (row: Dish & { totalOrders?: number; canDelete?: boolean }) =>
                mapDishRow(row),
            )
          : [],
      );
    } catch {
      if (gen !== loadGen.current) return;
      setDishes([]);
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!filter) return;
    void loadDishes(filter);
  }, [filter, loadDishes]);

  const reload = useCallback(() => {
    const status = filterRef.current;
    if (status) void loadDishes(status);
  }, [loadDishes]);

  const showNewBtn = !loading && filter !== null && dishes.length > 0;

  const emptyTitle =
    filter === "draft"
      ? "No draft meals"
      : filter === "active"
        ? "No active meals"
        : "No inactive meals";
  const emptyDesc =
    filter === "draft"
      ? "Save a draft from New meal to finish later."
      : "Create a meal to start taking orders.";

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
                onClick={() => selectFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {showNewBtn && (
            <Link
              href="/business/listings/dishes/new"
              className={styles.newBtn}
            >
              <Plus size={16} /> New meal
            </Link>
          )}
        </div>

        {loading || filter === null ? (
          <div className={styles.grid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={styles.card} aria-hidden="true">
                <div className={styles.cardBody}>
                  <div className={styles.cardTopRow}>
                    <Skeleton width="55%" height={17} radius={6} />
                    <Skeleton width={68} height={22} radius={11} />
                  </div>
                  <Skeleton
                    width={64}
                    height={20}
                    radius={6}
                    style={{ marginTop: 12 }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : dishes.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyMark} aria-hidden>
              <Utensils size={22} strokeWidth={1.5} />
            </div>
            <p className={styles.emptyTitle}>{emptyTitle}</p>
            <p className={styles.emptyDesc}>{emptyDesc}</p>
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
              <div key={dish.id} className={styles.card}>
                <div className={styles.cardBody}>
                  <div className={styles.cardTopRow}>
                    <Link
                      href={`/business/listings/dishes/${dish.id}`}
                      className={styles.cardTitleLink}
                    >
                      <h3 className={styles.cardTitle}>{dish.name}</h3>
                    </Link>
                    <div className={styles.cardTopActions}>
                      <StatusPill status={dish.status} />
                      <DishMenu dish={dish} onChanged={reload} />
                    </div>
                  </div>
                  <Link
                    href={`/business/listings/dishes/${dish.id}`}
                    className={styles.cardDetailLink}
                  >
                    <p className={styles.mealPrice}>
                      {dish.status === "draft" && Number(dish.price) <= 0
                        ? "Price not set"
                        : `$${Number(dish.price).toFixed(2)}`}
                    </p>
                    {dish.totalOrders > 0 && (
                      <p className={styles.mealMeta}>
                        {dish.totalOrders}{" "}
                        {dish.totalOrders === 1 ? "order" : "orders"}
                      </p>
                    )}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
