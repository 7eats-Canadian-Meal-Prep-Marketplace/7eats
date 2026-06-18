"use client";

import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

// ─── Constants ──────────────────────────────────────────────────────────────────

type Ingredient = { id: string; name: string; amount: string; unit: string };
type DishStatus = "active" | "draft";

const ALLERGENS = [
  "Gluten",
  "Dairy",
  "Eggs",
  "Peanuts",
  "Tree nuts",
  "Soy",
  "Shellfish",
  "Fish",
  "Sesame",
];

const STEPS: { n: 1 | 2; label: string }[] = [
  { n: 1, label: "Dish details" },
  { n: 2, label: "Nutrition & ingredients" },
];

const EMPTY_FORM = {
  name: "",
  price: "",
  cuisine: "",
  description: "",
  status: "active" as DishStatus,
};

const EMPTY_NUTRITION = { calories: "", protein: "", carbs: "", fat: "" };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewDishPage() {
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [created, setCreated] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [nutrition, setNutrition] = useState(EMPTY_NUTRITION);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Release the object URL when it changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    // Allow re-selecting the same file later (onChange won't fire otherwise).
    e.target.value = "";
  }

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
    field: keyof Ingredient,
    value: string,
  ) {
    setIngredients((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    );
  }

  function toggleAllergen(allergen: string) {
    setAllergens((prev) =>
      prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen],
    );
  }

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  function resetAll() {
    setForm(EMPTY_FORM);
    setIngredients([]);
    setNutrition(EMPTY_NUTRITION);
    setAllergens([]);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setStep(1);
  }

  async function handleCreate() {
    setSaveError(null);
    const priceNum = Number(form.price);
    if (!form.name.trim()) {
      setSaveError("Please enter a name.");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setSaveError("Please enter a price greater than 0.");
      return;
    }
    try {
      const res = await fetch("/api/business/dishes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          price: Math.round(priceNum * 100) / 100,
          cuisine: form.cuisine.trim() || undefined,
          description: form.description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Could not create the meal.");
        return;
      }
      setCreated(true);
      setTimeout(() => router.push("/business/listings"), 900);
    } catch {
      setSaveError("Network error — please try again.");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/business/listings" className={styles.back}>
          <ArrowLeft size={15} />
          Listings
        </Link>
        <h1 className={styles.title}>New dish</h1>
      </div>

      {/* Progress indicator */}
      <div className={styles.steps}>
        {STEPS.map((s, i) => (
          <div key={s.n} className={styles.stepWrap}>
            <div
              className={`${styles.step} ${step === s.n ? styles.stepActive : ""} ${
                step > s.n ? styles.stepDone : ""
              }`}
            >
              <span className={styles.stepNum}>
                {step > s.n ? <Check size={13} /> : s.n}
              </span>
              <span className={styles.stepLabel}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={styles.stepBar} />}
          </div>
        ))}
      </div>

      <div className={styles.content} key={step}>
        {step === 1 && (
          <form className={styles.form} onSubmit={handleStep1Submit}>
            <div className={styles.formGroup}>
              <label htmlFor="f-name" className={styles.formLabel}>
                Name
              </label>
              <input
                id="f-name"
                type="text"
                className={styles.formInput}
                value={form.name}
                placeholder="e.g. Jollof Rice & Chicken"
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
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
                value={form.price}
                placeholder="e.g. 14.00"
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
                required
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
                placeholder="e.g. West African"
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
                placeholder="Describe the dish."
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Status</span>
              <div className={styles.segControl}>
                {(["active", "draft"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.segBtn} ${form.status === s ? styles.segBtnActive : ""}`}
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                  >
                    {s === "active" ? "Active" : "Draft"}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Cover photo</span>
              <div className={styles.coverWrap}>
                <div className={styles.coverImgWrap}>
                  {coverPreview ? (
                    // Object-URL preview — plain <img> since next/image can't
                    // optimize blob: URLs.
                    // biome-ignore lint/performance/noImgElement: local file preview, not a remote asset
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className={styles.coverImg}
                    />
                  ) : (
                    <Image
                      src="/placeholder.jpg"
                      alt="Cover"
                      fill
                      className={styles.coverImg}
                    />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleCoverSelect}
                />
                <button
                  type="button"
                  className={styles.coverUploadBtn}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {coverPreview ? "Change photo" : "Upload photo"}
                </button>
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={styles.saveBtn}>
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className={styles.step2}>
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
                      setNutrition((n) => ({ ...n, calories: e.target.value }))
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
                      setNutrition((n) => ({ ...n, protein: e.target.value }))
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
                      setNutrition((n) => ({ ...n, carbs: e.target.value }))
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
                      setNutrition((n) => ({ ...n, fat: e.target.value }))
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
                        checked={allergens.includes(allergen)}
                        onChange={() => toggleAllergen(allergen)}
                      />
                      {allergen}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {saveError && (
              <p style={{ color: "var(--red, #e23744)", marginBottom: 12 }}>
                {saveError}
              </p>
            )}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleCreate}
              >
                {created ? "Created!" : "Create dish"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setStep(1)}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
