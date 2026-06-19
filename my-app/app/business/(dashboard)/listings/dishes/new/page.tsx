"use client";

import { Check, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { mealToastError, mealToastSuccess } from "@/lib/meal-toast";
import {
  DISH_PHOTO_ACCEPT,
  validateDishPhotoFile,
} from "@/lib/upload-validation";
import styles from "./page.module.css";

// ─── Constants ──────────────────────────────────────────────────────────────────

type Ingredient = { id: string; name: string };

const DESCRIPTION_MAX = 500;

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
] as const;

const STEPS: { n: 1 | 2; label: string }[] = [
  { n: 1, label: "Dish details" },
  { n: 2, label: "Nutrition & ingredients" },
];

const EMPTY_FORM = {
  name: "",
  price: "",
  description: "",
};

const EMPTY_NUTRITION = { calories: "", protein: "", carbs: "", fat: "" };

function isValidPrice(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0;
}

function step1Complete(form: typeof EMPTY_FORM, hasPhoto: boolean): boolean {
  return (
    !!form.name.trim() &&
    isValidPrice(form.price) &&
    !!form.description.trim() &&
    form.description.length <= DESCRIPTION_MAX &&
    hasPhoto
  );
}

function step2Complete(
  ingredients: Ingredient[],
  allergens: string[],
  noneApplies: boolean,
): boolean {
  const ingredientsOk =
    ingredients.length > 0 &&
    ingredients.every((i) => i.name.trim().length > 0);
  const allergensOk = noneApplies || allergens.length > 0;
  return ingredientsOk && allergensOk;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewDishPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [nutrition, setNutrition] = useState(EMPTY_NUTRITION);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [noneApplies, setNoneApplies] = useState(false);
  const [showIngErrors, setShowIngErrors] = useState(false);
  const [showAllergenError, setShowAllergenError] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<File | null>(null);

  const hasPhoto = !!coverPreview;

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function setCoverFile(file: File | null) {
    if (!file) return;
    const err = validateDishPhotoFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    coverFileRef.current = file;
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCoverFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setCoverFile(file);
  }

  async function uploadCoverPhoto(dishId: string) {
    const file = coverFileRef.current;
    if (!file) return false;
    const fd = new FormData();
    fd.set("photo", file);
    fd.set("isPrimary", "true");
    const res = await fetch(`/api/business/dishes/${dishId}/photos/upload`, {
      method: "POST",
      body: fd,
    });
    return res.ok;
  }

  function addIngredient() {
    if (ingredients.some((i) => !i.name.trim())) {
      setShowIngErrors(true);
      toast.error("Fill in the current ingredient before adding another.");
      return;
    }
    setIngredients((prev) => [...prev, { id: `ing-${Date.now()}`, name: "" }]);
  }

  function removeIngredient(id: string) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  function updateIngredient(id: string, value: string) {
    setIngredients((prev) =>
      prev.map((i) => (i.id === id ? { ...i, name: value } : i)),
    );
    if (value.trim()) setShowIngErrors(false);
  }

  function toggleAllergen(allergen: string) {
    if (noneApplies) setNoneApplies(false);
    setShowAllergenError(false);
    setAllergens((prev) =>
      prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen],
    );
  }

  function handleNoneApplies() {
    setShowAllergenError(false);
    setNoneApplies((prev) => {
      if (!prev) setAllergens([]);
      return !prev;
    });
  }

  function validateStep1(): boolean {
    if (!form.name.trim()) {
      toast.error("Enter a dish name.");
      return false;
    }
    if (!isValidPrice(form.price)) {
      toast.error("Enter a valid price with up to 2 decimal places.");
      return false;
    }
    if (!form.description.trim()) {
      toast.error("Enter a description.");
      return false;
    }
    if (form.description.length > DESCRIPTION_MAX) {
      toast.error(
        `Description must be ${DESCRIPTION_MAX} characters or fewer.`,
      );
      return false;
    }
    if (!coverFileRef.current) {
      toast.error("Upload a cover photo before continuing.");
      return false;
    }
    return true;
  }

  function handleStep1Continue() {
    if (!validateStep1()) return;
    if (ingredients.length === 0) {
      setIngredients([{ id: `ing-${Date.now()}`, name: "" }]);
    }
    setStep(2);
  }

  function validateStep2(): boolean {
    let ok = true;
    if (ingredients.length === 0 || ingredients.some((i) => !i.name.trim())) {
      setShowIngErrors(true);
      toast.error(
        ingredients.length === 0
          ? "Add at least one ingredient."
          : "Every ingredient must have a name.",
      );
      ok = false;
    }
    if (!noneApplies && allergens.length === 0) {
      setShowAllergenError(true);
      toast.error("Select allergens or check “None of these apply”.");
      ok = false;
    }
    return ok;
  }

  async function handleCreate() {
    if (!validateStep2()) return;
    if (!coverFileRef.current) {
      toast.error("Cover photo is required.");
      setStep(1);
      return;
    }

    setSubmitting(true);
    try {
      const priceNum = Number(form.price);
      const num = (v: string) => {
        const n = Number(v);
        return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
      };

      const res = await fetch("/api/business/dishes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          price: Math.round(priceNum * 100) / 100,
          description: form.description.trim(),
          status: "active",
          ingredients: ingredients
            .filter((i) => i.name.trim())
            .map((i) => ({ name: i.name.trim() })),
          allergens,
          allergenNoneApplies: noneApplies,
          nutrition: {
            calories: num(nutrition.calories),
            proteinG: num(nutrition.protein),
            carbsG: num(nutrition.carbs),
            fatG: num(nutrition.fat),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        mealToastError(data.error ?? "Could not create the meal.");
        return;
      }

      const dishId: string | undefined = data.data?.id;
      if (dishId) {
        const uploaded = await uploadCoverPhoto(dishId);
        if (!uploaded) {
          mealToastError(
            "Meal created but photo upload failed. Add a photo from the edit page.",
          );
        }
      }

      mealToastSuccess("Meal created");
      router.push("/business/listings");
    } catch {
      mealToastError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    router.push("/business/listings");
  }

  function handlePriceChange(value: string) {
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setForm((f) => ({ ...f, price: value }));
    }
  }

  const canContinue = step1Complete(form, hasPhoto);
  const canCreate =
    step2Complete(ingredients, allergens, noneApplies) && !submitting;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>New meal</h1>
      </div>

      <div className={styles.steps}>
        {STEPS.map((s, i) => (
          <div key={s.n} className={styles.stepWrap}>
            <button
              type="button"
              className={`${styles.step} ${step === s.n ? styles.stepActive : ""} ${
                step > s.n ? styles.stepDone : ""
              } ${step === 2 && s.n === 1 ? styles.stepClickable : ""}`}
              disabled={!(step === 2 && s.n === 1)}
              onClick={() => {
                if (step === 2 && s.n === 1) setStep(1);
              }}
            >
              <span className={styles.stepNum}>
                {step > s.n ? <Check size={13} /> : s.n}
              </span>
              <span className={styles.stepLabel}>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={styles.stepBar} />}
          </div>
        ))}
      </div>

      <div className={styles.content} key={step}>
        {step === 1 && (
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="f-name" className={styles.formLabel}>
                Name <span className={styles.required}>*</span>
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
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="f-price" className={styles.formLabel}>
                Price per meal <span className={styles.required}>*</span>
              </label>
              <input
                id="f-price"
                type="text"
                inputMode="decimal"
                className={styles.formInput}
                value={form.price}
                placeholder="e.g. 14.00"
                onChange={(e) => handlePriceChange(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="f-description" className={styles.formLabel}>
                Description <span className={styles.required}>*</span>
              </label>
              <textarea
                id="f-description"
                className={styles.formTextarea}
                value={form.description}
                rows={4}
                maxLength={DESCRIPTION_MAX}
                placeholder="Describe the dish."
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
              <span
                className={`${styles.charCount} ${
                  form.description.length >= DESCRIPTION_MAX
                    ? styles.charCountLimit
                    : ""
                }`}
              >
                {form.description.length}/{DESCRIPTION_MAX}
              </span>
            </div>

            <div className={styles.formGroup}>
              <span className={styles.formLabel}>
                Cover photo <span className={styles.required}>*</span>
              </span>
              <button
                type="button"
                className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {coverPreview ? (
                  // biome-ignore lint/performance/noImgElement: local file preview
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className={styles.coverImg}
                  />
                ) : (
                  <div className={styles.dropzoneEmpty}>
                    <Upload size={22} strokeWidth={1.5} />
                    <span>Drag and drop or click to upload</span>
                    <span className={styles.dropzoneHint}>
                      JPG, PNG, or WebP · max 10 MB
                    </span>
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={DISH_PHOTO_ACCEPT}
                hidden
                onChange={handleCoverSelect}
              />
              {coverPreview && (
                <button
                  type="button"
                  className={styles.changePhotoBtn}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={14} />
                  Change photo
                </button>
              )}
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                disabled={!canContinue}
                onClick={handleStep1Continue}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.step2}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                Ingredients <span className={styles.required}>*</span>
              </h3>
              <p className={styles.sectionHint}>
                Add at least one ingredient. Names only — no amounts.
              </p>

              {ingredients.length > 0 && (
                <div className={styles.ingList}>
                  {ingredients.map((ing) => (
                    <div key={ing.id} className={styles.ingRowSimple}>
                      <input
                        type="text"
                        aria-label="Ingredient name"
                        aria-invalid={
                          showIngErrors && !ing.name.trim() ? true : undefined
                        }
                        className={`${styles.formInput} ${
                          showIngErrors && !ing.name.trim()
                            ? styles.fieldError
                            : ""
                        }`}
                        value={ing.name}
                        placeholder="e.g. Tomato paste"
                        onChange={(e) =>
                          updateIngredient(ing.id, e.target.value)
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
                <p className={styles.emptyNote}>Add at least one ingredient.</p>
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

              <div
                className={`${styles.allergensWrap} ${
                  showAllergenError ? styles.fieldErrorWrap : ""
                }`}
              >
                <span className={styles.formLabel}>
                  Allergens <span className={styles.required}>*</span>
                </span>
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
                        disabled={noneApplies}
                        onChange={() => toggleAllergen(allergen)}
                      />
                      {allergen}
                    </label>
                  ))}
                  <label
                    htmlFor="allergen-none"
                    className={styles.allergenLabel}
                  >
                    <input
                      id="allergen-none"
                      type="checkbox"
                      className={styles.allergenCheck}
                      checked={noneApplies}
                      onChange={handleNoneApplies}
                    />
                    None of these apply
                  </label>
                </div>
              </div>
            </section>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                Back to details
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                disabled={!canCreate}
                onClick={handleCreate}
              >
                {submitting ? "Creating…" : "Create meal"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
