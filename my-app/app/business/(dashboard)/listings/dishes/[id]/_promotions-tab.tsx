"use client";

import { Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

export function PromotionsTab() {
  const params = useParams<{ id: string }>();
  const dishId = params.id;

  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<"percentage_off" | "fixed_off">(
    "percentage_off",
  );
  const [value, setValue] = useState("");
  const [limitKind, setLimitKind] = useState<LimitKind>("date");
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Enter a value greater than 0.");
      return;
    }
    const body: Record<string, unknown> = { type, value: num };
    if (limitKind === "date") {
      if (!validUntil) {
        setError("Choose an end date.");
        return;
      }
      body.validUntil = new Date(validUntil).toISOString();
    } else {
      const uses = Number(maxUses);
      if (!Number.isInteger(uses) || uses < 1) {
        setError("Enter a max redemptions of at least 1.");
        return;
      }
      body.maxUses = uses;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/business/dishes/${dishId}/promotions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create the promotion.");
        return;
      }
      setValue("");
      setValidUntil("");
      setMaxUses("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(promo: Promotion) {
    await fetch(
      `/api/business/dishes/${dishId}/promotions/${promo.id}/toggle`,
      { method: "POST" },
    );
    load();
  }

  async function remove(promo: Promotion) {
    await fetch(`/api/business/dishes/${dishId}/promotions/${promo.id}`, {
      method: "DELETE",
    });
    load();
  }

  function describe(p: Promotion): string {
    const amount =
      p.type === "percentage_off"
        ? `${Number(p.value)}% off`
        : `$${Number(p.value)} off`;
    const limit =
      p.maxUses != null
        ? `${p.usesCount}/${p.maxUses} used`
        : p.validUntil
          ? `ends ${new Date(p.validUntil).toLocaleDateString()}`
          : "";
    return limit ? `${amount} · ${limit}` : amount;
  }

  return (
    <div className={styles.detailsTab}>
      <form onSubmit={handleCreate} className={styles.overviewLeft}>
        <h3 className={styles.formLabel}>Add a promotion</h3>

        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="promo-type">
            Discount type
          </label>
          <select
            id="promo-type"
            className={styles.formInput}
            value={type}
            onChange={(e) =>
              setType(e.target.value as "percentage_off" | "fixed_off")
            }
          >
            <option value="percentage_off">% off</option>
            <option value="fixed_off">$ off</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="promo-value">
            {type === "percentage_off" ? "Percent (1–100)" : "Amount ($)"}
          </label>
          <input
            id="promo-value"
            type="number"
            min="0.01"
            step="0.01"
            className={styles.formInput}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <span className={styles.formLabel}>Limit (choose one)</span>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="radio"
              name="limit"
              checked={limitKind === "date"}
              onChange={() => setLimitKind("date")}
            />
            End date
          </label>
          {limitKind === "date" && (
            <input
              type="date"
              className={styles.formInput}
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          )}
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="radio"
              name="limit"
              checked={limitKind === "uses"}
              onChange={() => setLimitKind("uses")}
            />
            Max redemptions
          </label>
          {limitKind === "uses" && (
            <input
              type="number"
              min="1"
              step="1"
              className={styles.formInput}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          )}
        </div>

        {error && <p style={{ color: "var(--red, #e23744)" }}>{error}</p>}
        <button type="submit" className={styles.saveBtn} disabled={submitting}>
          <Plus size={16} /> {submitting ? "Adding…" : "Add promotion"}
        </button>
      </form>

      <div className={styles.overviewLeft} style={{ marginTop: 24 }}>
        <h3 className={styles.formLabel}>Existing promotions</h3>
        {loading ? (
          <p className={styles.emptyNote}>Loading…</p>
        ) : promos.length === 0 ? (
          <p className={styles.emptyNote}>No promotions yet.</p>
        ) : (
          <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {promos.map((p) => (
              <li
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  border: "1px solid var(--grey-200, #e5e7eb)",
                  borderRadius: 10,
                  opacity: p.isActive ? 1 : 0.55,
                }}
              >
                <span>{describe(p)}</span>
                <span style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => toggle(p)}
                  >
                    {p.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => remove(p)}
                    aria-label="Delete promotion"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
