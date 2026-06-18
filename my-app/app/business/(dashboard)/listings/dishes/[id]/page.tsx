"use client";

import { Camera, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BackToDishes } from "../../_back-link";
import {
  ALLERGENS,
  DishDetailProvider,
  type IngredientRow,
  useDishDetail,
} from "./_dish-detail-context";
import { PromotionsTab } from "./_promotions-tab";
import styles from "./page.module.css";

type Tab = "details" | "nutrition" | "promotions";

const MAX_PHOTOS = 8;

// ─── Details tab ──────────────────────────────────────────────────────────────

function DetailsTab() {
  const { stats, form, photos, saveDetails, removePhoto, loading } =
    useDishDetail();
  const [localForm, setLocalForm] = useState({
    name: "",
    price: "",
    cuisine: "",
    description: "",
    status: "active" as "active" | "draft" | "archived",
  });
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (form && !initialized) {
      setLocalForm(form);
      setInitialized(true);
    }
  }, [form, initialized]);

  async function handleRemovePhoto(id: string) {
    await removePhoto(id);
  }

  async function handleSave() {
    const ok = await saveDetails({
      name: localForm.name,
      price: localForm.price,
      cuisine: localForm.cuisine,
      description: localForm.description,
    });
    if (!ok) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading && !initialized) {
    return <p className={styles.emptyNote}>Loading dish…</p>;
  }

  return (
    <div className={styles.detailsTab}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total orders</span>
          <span className={styles.statVal}>{stats.totalOrders}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>In listings</span>
          <span className={styles.statVal}>{stats.listingCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Avg qty / order</span>
          <span className={styles.statVal}>
            {stats.avgQtyPerOrder.toFixed(1)}
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
              value={localForm.name}
              onChange={(e) =>
                setLocalForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="f-price" className={styles.formLabel}>
              Price per meal
            </label>
            <input
              id="f-price"
              type="number"
              min="0.01"
              step="0.01"
              className={styles.formInput}
              value={localForm.price}
              onChange={(e) =>
                setLocalForm((f) => ({ ...f, price: e.target.value }))
              }
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
              value={localForm.cuisine}
              onChange={(e) =>
                setLocalForm((f) => ({ ...f, cuisine: e.target.value }))
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
              value={localForm.description}
              rows={6}
              onChange={(e) =>
                setLocalForm((f) => ({ ...f, description: e.target.value }))
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
                    onClick={() => void handleRemovePhoto(photo.id)}
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
              value={localForm.status}
              onChange={(e) =>
                setLocalForm((f) => ({
                  ...f,
                  status: e.target.value as typeof localForm.status,
                }))
              }
            >
              {localForm.status === "draft" && (
                <option value="draft">Draft</option>
              )}
              <option value="active">Active</option>
              <option value="archived" disabled={stats.listingCount > 0}>
                Archived
              </option>
            </select>
            {stats.listingCount > 0 && (
              <div className={styles.listingBlock}>
                <span className={styles.listingBlockCount}>
                  In {stats.listingCount} listing
                  {stats.listingCount !== 1 ? "s" : ""}
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
  const {
    ingredients,
    setIngredients,
    nutrition,
    setNutrition,
    saveNutrition,
    loading,
  } = useDishDetail();
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [otherChecked, setOtherChecked] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && !initialized) {
      setInitialized(true);
    }
  }, [loading, initialized]);

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
    field: keyof IngredientRow,
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

  async function handleSave() {
    setSaveAttempted(true);
    if (ingredients.some((i) => !i.name.trim())) return;
    setSaveAttempted(false);
    const ok = await saveNutrition({
      ingredients,
      nutrition,
      otherChecked,
      otherText,
    });
    if (!ok) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading && !initialized) {
    return <p className={styles.emptyNote}>Loading nutrition…</p>;
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
  { id: "promotions", label: "Promotions" },
];

export default function DishDetailPage() {
  const params = useParams<{ id: string }>();
  const dishId = params.id;

  if (!dishId) {
    return <p className={styles.emptyNote}>Dish not found.</p>;
  }

  return (
    <DishDetailProvider dishId={dishId}>
      <DishDetailContent />
    </DishDetailProvider>
  );
}

function DishDetailContent() {
  const { loading, error } = useDishDetail();
  const [tab, setTab] = useState<Tab>("details");

  if (loading) {
    return (
      <div className={styles.page}>
        <BackToDishes />
        <p className={styles.emptyNote}>Loading dish…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <BackToDishes />
        <p className={styles.emptyNote}>{error}</p>
      </div>
    );
  }

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
        {tab === "promotions" && <PromotionsTab />}
      </div>
    </div>
  );
}
