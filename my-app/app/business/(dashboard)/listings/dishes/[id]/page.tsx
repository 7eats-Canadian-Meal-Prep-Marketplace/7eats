"use client";

import { Camera, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { BackToDishes } from "../../_back-link";
import {
  ALLERGENS,
  MOCK_DISH,
  MOCK_DISH_PHOTOS,
  MOCK_INGREDIENTS,
  MOCK_NUTRITION,
  type MockDishPhoto,
  type MockIngredient,
} from "./_mock";
import styles from "./page.module.css";

type Tab = "details" | "nutrition";

const MAX_PHOTOS = 8;

// ─── Details tab ──────────────────────────────────────────────────────────────

function DetailsTab() {
  const [form, setForm] = useState({
    name: MOCK_DISH.name,
    cuisine: MOCK_DISH.cuisine,
    description: MOCK_DISH.description,
    status: MOCK_DISH.status as "active" | "draft" | "archived",
  });
  const [photos, setPhotos] = useState<MockDishPhoto[]>(MOCK_DISH_PHOTOS);
  const [saved, setSaved] = useState(false);

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

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

      <div className={styles.overviewColumns}>
        {/* Left — primary info + photos + save */}
        <div className={styles.overviewLeft}>
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
              rows={6}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.photoLabelRow}>
              <span className={styles.formLabel}>Photos</span>
              <span className={styles.photoCount}>
                {photos.length} / {MAX_PHOTOS}
              </span>
            </div>
            <div className={styles.photoStrip}>
              {photos.map((photo) => (
                <div key={photo.id} className={styles.photoThumb}>
                  <Image
                    src={photo.url}
                    alt="Dish photo"
                    fill
                    className={styles.photoImg}
                  />
                  <button
                    type="button"
                    className={styles.photoRemove}
                    onClick={() => removePhoto(photo.id)}
                    aria-label="Remove photo"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" className={styles.photoAdd}>
                  <Camera size={15} className={styles.photoAddIcon} />
                  <span>Add photo</span>
                </button>
              )}
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
            >
              {saved ? "Saved" : "Save changes"}
            </button>
          </div>
        </div>

        {/* Right — availability card */}
        <div className={styles.overviewRight}>
          <div className={styles.statusCard}>
            <span className={styles.statusCardLabel}>Availability</span>
            <select
              className={styles.formSelect}
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as typeof form.status,
                }))
              }
            >
              {form.status === "draft" && <option value="draft">Draft</option>}
              <option value="active">Active</option>
              <option value="archived" disabled={MOCK_DISH.listingCount > 0}>
                Archived
              </option>
            </select>
            {MOCK_DISH.listingCount > 0 && (
              <div className={styles.listingBlock}>
                <span className={styles.listingBlockCount}>
                  In {MOCK_DISH.listingCount} listing
                  {MOCK_DISH.listingCount !== 1 ? "s" : ""}
                </span>
                <span className={styles.listingBlockDesc}>
                  Remove from all listings to archive this dish.
                </span>
              </div>
            )}
          </div>
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
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [otherChecked, setOtherChecked] = useState(false);
  const [otherText, setOtherText] = useState("");

  const hasIngError = saveAttempted && ingredients.some((i) => !i.name.trim());

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
    if (allergen === "Other") {
      if (otherChecked) {
        setOtherChecked(false);
        setOtherText("");
      } else {
        setOtherChecked(true);
      }
      return;
    }
    setNutrition((prev) => ({
      ...prev,
      allergens: prev.allergens.includes(allergen)
        ? prev.allergens.filter((a) => a !== allergen)
        : [...prev.allergens, allergen],
    }));
  }

  function handleSave() {
    setSaveAttempted(true);
    if (ingredients.some((i) => !i.name.trim())) return;
    setSaveAttempted(false);
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
                  className={`${styles.ingInput} ${styles.ingNameInput} ${hasIngError && !ing.name.trim() ? styles.ingInputError : ""}`}
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
            {ALLERGENS.map((allergen) => {
              const isOther = allergen === "Other";
              const checked = isOther
                ? otherChecked
                : nutrition.allergens.includes(allergen);
              return (
                <label
                  key={allergen}
                  htmlFor={`allergen-${allergen}`}
                  className={styles.allergenLabel}
                >
                  <input
                    id={`allergen-${allergen}`}
                    type="checkbox"
                    className={styles.allergenCheck}
                    checked={checked}
                    onChange={() => toggleAllergen(allergen)}
                  />
                  {allergen}
                </label>
              );
            })}
          </div>
          {otherChecked && (
            <input
              type="text"
              className={`${styles.formInput} ${styles.otherInput}`}
              value={otherText}
              placeholder="Specify allergen e.g. Sesame"
              onChange={(e) => setOtherText(e.target.value)}
            />
          )}
        </div>
      </section>

      {hasIngError && (
        <p className={styles.ingError}>
          All ingredients must have a name before saving.
        </p>
      )}

      <div className={styles.formActions}>
        <button type="button" className={styles.saveBtn} onClick={handleSave}>
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "nutrition", label: "Nutrition & Ingredients" },
];

export default function DishDetailPage() {
  const [tab, setTab] = useState<Tab>("details");

  return (
    <div className={styles.page}>
      <BackToDishes />
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
      </div>
    </div>
  );
}
