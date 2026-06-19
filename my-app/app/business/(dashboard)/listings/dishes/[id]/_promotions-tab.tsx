"use client";

import { AlertTriangle, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "../../../_components/ConfirmDialog";
import styles from "./page.module.css";

type Promotion = {
  id: string;
  type: "percentage_off" | "fixed_off";
  value: string;
  maxUses: number | null;
  usesCount: number;
  isActive: boolean;
  validUntil: string | null;
};

type LimitKind = "date" | "uses";

function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function promoAmount(p: Promotion): string {
  return p.type === "percentage_off"
    ? `${Number(p.value)}% off`
    : `$${Number(p.value).toFixed(2)} off`;
}

function promoLimit(p: Promotion): string {
  if (p.maxUses != null) return `${p.usesCount} / ${p.maxUses} redeemed`;
  if (p.validUntil) {
    return `Ends ${new Date(p.validUntil).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }
  return "";
}

function promoStatus(p: Promotion): { label: string; live: boolean } {
  if (!p.isActive) return { label: "Inactive", live: false };
  if (p.validUntil && new Date(p.validUntil) <= new Date()) {
    return { label: "Expired", live: false };
  }
  if (p.maxUses != null && p.usesCount >= p.maxUses) {
    return { label: "Limit reached", live: false };
  }
  return { label: "Active", live: true };
}

export function PromotionsTab() {
  const params = useParams<{ id: string }>();
  const dishId = params.id;
  const router = useRouter();

  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<"percentage_off" | "fixed_off">(
    "percentage_off",
  );
  const [value, setValue] = useState("");
  const [limitKind, setLimitKind] = useState<LimitKind>("date");
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/business/dishes/${dishId}/promotions`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setPromos(Array.isArray(json.data) ? json.data : []))
      .catch(() => setPromos([]))
      .finally(() => setLoading(false));
  }, [dishId]);

  useEffect(() => {
    load();
  }, [load]);

  function setTypeAndClamp(next: "percentage_off" | "fixed_off") {
    setType(next);
    // Switching to % off invalidates any value above 100 — drop it.
    if (next === "percentage_off" && Number(value) > 100) setValue("");
  }

  function handleValueChange(raw: string) {
    if (raw === "") {
      setValue("");
      return;
    }
    // Digits only, with at most two decimal places.
    if (!/^\d*\.?\d{0,2}$/.test(raw)) return;
    // Percentage can never exceed 100.
    if (type === "percentage_off" && Number(raw) > 100) return;
    setValue(raw);
  }

  function handleMaxUsesChange(raw: string) {
    // Whole numbers only — no letters, no decimals.
    if (raw === "" || /^\d+$/.test(raw)) setMaxUses(raw);
  }

  const valueNum = Number(value);
  const valueValid =
    value !== "" &&
    Number.isFinite(valueNum) &&
    valueNum > 0 &&
    (type !== "percentage_off" || valueNum <= 100);
  const limitValid =
    limitKind === "date"
      ? validUntil !== "" && new Date(validUntil) > new Date(todayInputValue())
      : maxUses !== "" && Number(maxUses) >= 1;
  const canSubmit = valueValid && limitValid && !submitting;

  async function handleCreate() {
    const num = Number(value);
    const body: Record<string, unknown> = { type, value: num };
    if (limitKind === "date") {
      body.validUntil = new Date(validUntil).toISOString();
    } else {
      body.maxUses = Number(maxUses);
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/business/dishes/${dishId}/promotions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not create the promotion.");
        return;
      }
      toast.success("Promotion added.");
      setValue("");
      setValidUntil("");
      setMaxUses("");
      setConfirmOpen(false);
      load();
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.promoTab}>
      <div className={styles.disclaimer}>
        <AlertTriangle size={16} className={styles.disclaimerIcon} />
        <div>
          <p className={styles.disclaimerTitle}>Promotions are permanent</p>
          <p className={styles.disclaimerText}>
            Once you add a promotion it can&rsquo;t be edited or removed. It
            ends automatically when it reaches its end date or redemption limit.
            Only one promotion can be active per dish — adding a new one
            replaces the current active promotion.
          </p>
        </div>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Add a promotion</h3>

        <div className={styles.formGroup}>
          <span className={styles.formLabel}>Discount type</span>
          <div className={styles.segControl}>
            <button
              type="button"
              className={`${styles.segBtn} ${
                type === "percentage_off" ? styles.segBtnActive : ""
              }`}
              onClick={() => setTypeAndClamp("percentage_off")}
            >
              % off
            </button>
            <button
              type="button"
              className={`${styles.segBtn} ${
                type === "fixed_off" ? styles.segBtnActive : ""
              }`}
              onClick={() => setTypeAndClamp("fixed_off")}
            >
              $ off
            </button>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="promo-value">
            {type === "percentage_off"
              ? "Percentage off (1–100)"
              : "Amount off ($)"}
          </label>
          <input
            id="promo-value"
            type="text"
            inputMode="decimal"
            className={styles.formInput}
            value={value}
            placeholder={type === "percentage_off" ? "e.g. 15" : "e.g. 5.00"}
            onChange={(e) => handleValueChange(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <span className={styles.formLabel}>Limit</span>
          <div className={styles.segControl}>
            <button
              type="button"
              className={`${styles.segBtn} ${
                limitKind === "date" ? styles.segBtnActive : ""
              }`}
              onClick={() => setLimitKind("date")}
            >
              End date
            </button>
            <button
              type="button"
              className={`${styles.segBtn} ${
                limitKind === "uses" ? styles.segBtnActive : ""
              }`}
              onClick={() => setLimitKind("uses")}
            >
              Max redemptions
            </button>
          </div>
          {limitKind === "date" ? (
            <input
              type="date"
              className={styles.formInput}
              value={validUntil}
              min={todayInputValue()}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          ) : (
            <input
              type="text"
              inputMode="numeric"
              className={styles.formInput}
              value={maxUses}
              placeholder="e.g. 50"
              onChange={(e) => handleMaxUsesChange(e.target.value)}
            />
          )}
        </div>

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => router.push("/business/listings")}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.addPromoBtn}
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit}
          >
            <Plus size={16} />
            Add promotion
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Promotions</h3>
        {loading ? (
          <p className={styles.emptyNote}>Loading…</p>
        ) : promos.length === 0 ? (
          <p className={styles.emptyNote}>No promotions yet.</p>
        ) : (
          <ul className={styles.promoList}>
            {promos.map((p) => {
              const status = promoStatus(p);
              return (
                <li
                  key={p.id}
                  className={`${styles.promoCard} ${
                    status.live ? "" : styles.promoCardInactive
                  }`}
                >
                  <div className={styles.promoMain}>
                    <span className={styles.promoAmount}>{promoAmount(p)}</span>
                    {promoLimit(p) && (
                      <span className={styles.promoLimit}>{promoLimit(p)}</span>
                    )}
                  </div>
                  <span className={styles.promoBadge}>
                    <span
                      className={`${styles.promoDot} ${
                        status.live
                          ? styles.promoDotActive
                          : styles.promoDotInactive
                      }`}
                    />
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Add this promotion?"
        message="Promotions are permanent — once added it can't be edited or removed. It will end automatically at its end date or redemption limit."
        confirmLabel="Add promotion"
        busy={submitting}
        onConfirm={handleCreate}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
