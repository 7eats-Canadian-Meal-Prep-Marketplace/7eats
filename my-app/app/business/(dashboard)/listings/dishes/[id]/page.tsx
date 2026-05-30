"use client";

import { Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
  ALLERGENS,
  MOCK_DISH,
  MOCK_DISH_LISTINGS,
  MOCK_INGREDIENTS,
  MOCK_NUTRITION,
  type MockDishListing,
  type MockIngredient,
} from "./_mock";
import styles from "./page.module.css";

type Tab = "details" | "nutrition" | "stats";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<MockDishListing["status"], string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

const BADGE_CLS: Record<MockDishListing["status"], string> = {
  active: styles.badgeActive,
  draft: styles.badgeDraft,
  archived: styles.badgeArchived,
};

function StatusBadge({ status }: { status: MockDishListing["status"] }) {
  return (
    <span className={`${styles.badge} ${BADGE_CLS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Details tab ──────────────────────────────────────────────────────────────

function DetailsTab() {
  const [form, setForm] = useState({
    name: MOCK_DISH.name,
    cuisine: MOCK_DISH.cuisine,
    description: MOCK_DISH.description,
    status: MOCK_DISH.status as "active" | "draft" | "archived",
  });
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className={styles.detailsTab}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total orders</span>
          <span className={styles.statVal}>{MOCK_DISH.totalOrders}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>In listings</span>
          <span className={styles.statVal}>{MOCK_DISH.listingCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Avg qty / order</span>
          <span className={styles.statVal}>
            {MOCK_DISH.avgQtyPerOrder.toFixed(1)}
          </span>
        </div>
      </div>

      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="f-name" className={styles.formLabel}>
            Name
          </label>
          <input
            id="f-name"
            type="text"
            className={styles.formInput}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="f-cuisine" className={styles.formLabel}>
            Cuisine
          </label>
          <input
            id="f-cuisine"
            type="text"
            className={styles.formInput}
            value={form.cuisine}
            onChange={(e) =>
              setForm((f) => ({ ...f, cuisine: e.target.value }))
            }
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="f-description" className={styles.formLabel}>
            Description
          </label>
          <textarea
            id="f-description"
            className={styles.formTextarea}
            value={form.description}
            rows={4}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </div>

        <div className={styles.formGroup}>
          <span className={styles.formLabel}>Status</span>
          <div className={styles.segControl}>
            {(["active", "archived"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.segBtn} ${form.status === s ? styles.segBtnActive : ""}`}
                onClick={() => setForm((f) => ({ ...f, status: s }))}
              >
                {s === "active" ? "Active" : "Archived"}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <span className={styles.formLabel}>Cover photo</span>
          <div className={styles.coverWrap}>
            <div className={styles.coverImgWrap}>
              <Image
                src="/placeholder.jpg"
                alt="Cover"
                fill
                className={styles.coverImg}
              />
            </div>
            <button type="button" className={styles.coverUploadBtn}>
              Upload photo
            </button>
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            {saved ? "Saved" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Nutrition & Ingredients tab ──────────────────────────────────────────────

function NutritionTab() {
  const [ingredients, setIngredients] =
    useState<MockIngredient[]>(MOCK_INGREDIENTS);
  const [nutrition, setNutrition] = useState(MOCK_NUTRITION);
  const [saved, setSaved] = useState(false);

  function addIngredient() {
    setIngredients((prev) => [
      ...prev,
      { id: `ing-${Date.now()}`, name: "", amount: "", unit: "" },
    ]);
  }

  function removeIngredient(id: string) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  function updateIngredient(
    id: string,
    field: keyof MockIngredient,
    value: string,
  ) {
    setIngredients((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    );
  }

  function toggleAllergen(allergen: string) {
    setNutrition((prev) => ({
      ...prev,
      allergens: prev.allergens.includes(allergen)
        ? prev.allergens.filter((a) => a !== allergen)
        : [...prev.allergens, allergen],
    }));
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className={styles.nutritionTab}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Ingredients</h3>

        {ingredients.length > 0 && (
          <div className={styles.ingTable}>
            <div className={styles.ingHeader}>
              <span className={styles.ingColIngredient}>Ingredient</span>
              <span className={styles.ingColAmount}>Amount</span>
              <span className={styles.ingColUnit}>Unit</span>
              <span className={styles.ingColAction} />
            </div>
            {ingredients.map((ing) => (
              <div key={ing.id} className={styles.ingRow}>
                <input
                  type="text"
                  aria-label="Ingredient name"
                  className={`${styles.ingInput} ${styles.ingNameInput}`}
                  value={ing.name}
                  placeholder="e.g. Tomato paste"
                  onChange={(e) =>
                    updateIngredient(ing.id, "name", e.target.value)
                  }
                />
                <input
                  type="text"
                  aria-label="Amount"
                  className={`${styles.ingInput} ${styles.ingAmountInput}`}
                  value={ing.amount}
                  placeholder="2"
                  onChange={(e) =>
                    updateIngredient(ing.id, "amount", e.target.value)
                  }
                />
                <input
                  type="text"
                  aria-label="Unit"
                  className={`${styles.ingInput} ${styles.ingUnitInput}`}
                  value={ing.unit}
                  placeholder="cups"
                  onChange={(e) =>
                    updateIngredient(ing.id, "unit", e.target.value)
                  }
                />
                <button
                  type="button"
                  className={styles.ingRemoveBtn}
                  onClick={() => removeIngredient(ing.id)}
                  aria-label="Remove ingredient"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {ingredients.length === 0 && (
          <p className={styles.emptyNote}>No ingredients added yet.</p>
        )}

        <button
          type="button"
          className={styles.addIngBtn}
          onClick={addIngredient}
        >
          <Plus size={13} />
          Add ingredient
        </button>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Nutrition per serving</h3>
        <div className={styles.nutritionGrid}>
          <div className={styles.formGroup}>
            <label htmlFor="f-calories" className={styles.formLabel}>
              Calories
            </label>
            <input
              id="f-calories"
              type="number"
              min={0}
              className={styles.formInput}
              value={nutrition.calories}
              onChange={(e) =>
                setNutrition((n) => ({
                  ...n,
                  calories: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="f-protein" className={styles.formLabel}>
              Protein (g)
            </label>
            <input
              id="f-protein"
              type="number"
              min={0}
              className={styles.formInput}
              value={nutrition.protein}
              onChange={(e) =>
                setNutrition((n) => ({
                  ...n,
                  protein: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="f-carbs" className={styles.formLabel}>
              Carbs (g)
            </label>
            <input
              id="f-carbs"
              type="number"
              min={0}
              className={styles.formInput}
              value={nutrition.carbs}
              onChange={(e) =>
                setNutrition((n) => ({
                  ...n,
                  carbs: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="f-fat" className={styles.formLabel}>
              Fat (g)
            </label>
            <input
              id="f-fat"
              type="number"
              min={0}
              className={styles.formInput}
              value={nutrition.fat}
              onChange={(e) =>
                setNutrition((n) => ({ ...n, fat: Number(e.target.value) }))
              }
            />
          </div>
        </div>

        <div className={styles.allergensWrap}>
          <span className={styles.formLabel}>Allergens</span>
          <div className={styles.allergenList}>
            {ALLERGENS.map((allergen) => (
              <label
                key={allergen}
                htmlFor={`allergen-${allergen}`}
                className={styles.allergenLabel}
              >
                <input
                  id={`allergen-${allergen}`}
                  type="checkbox"
                  className={styles.allergenCheck}
                  checked={nutrition.allergens.includes(allergen)}
                  onChange={() => toggleAllergen(allergen)}
                />
                {allergen}
              </label>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.formActions}>
        <button type="button" className={styles.saveBtn} onClick={handleSave}>
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Stats tab ────────────────────────────────────────────────────────────────

function StatsTab() {
  return (
    <div className={styles.statsTab}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total orders</span>
          <span className={styles.statVal}>{MOCK_DISH.totalOrders}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>In listings</span>
          <span className={styles.statVal}>{MOCK_DISH.listingCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Avg qty / order</span>
          <span className={styles.statVal}>
            {MOCK_DISH.avgQtyPerOrder.toFixed(1)}
          </span>
        </div>
      </div>

      <div className={styles.listingsSection}>
        <p className={styles.listingsSectionLabel}>Appears in</p>
        {MOCK_DISH_LISTINGS.map((listing) => (
          <div key={listing.id} className={styles.listingRow}>
            <div className={styles.listingMain}>
              <span className={styles.listingTitle}>{listing.title}</span>
              <span className={styles.listingMeta}>
                {listing.ordersWithDish} orders
              </span>
            </div>
            <StatusBadge status={listing.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "nutrition", label: "Nutrition & Ingredients" },
  { id: "stats", label: "Stats" },
];

export default function DishDetailPage() {
  const [tab, setTab] = useState<Tab>("details");

  return (
    <div className={styles.page}>
      <div className={styles.tabRow}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.content} key={tab}>
        {tab === "details" && <DetailsTab />}
        {tab === "nutrition" && <NutritionTab />}
        {tab === "stats" && <StatsTab />}
      </div>
    </div>
  );
}
