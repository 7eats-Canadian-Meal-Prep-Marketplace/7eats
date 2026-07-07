"use client";

import { Check, ImagePlus, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import IngredientsInput, {
  type IngredientRow,
} from "@/app/components/IngredientsInput";
import RequirementsChecklist from "@/app/components/RequirementsChecklist";
import {
  EMPTY_MEAL_FORM,
  EMPTY_MEAL_NUTRITION,
  isEmptyMealDraft,
  MEAL_DESCRIPTION_MAX,
  type MealDraft,
  parseMealDraft,
  step1Requirements,
  step2Requirements,
} from "@/lib/dishes/new-meal-form";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { mealToastError, mealToastSuccess } from "@/lib/meal-toast";
import { isPriceKeystroke } from "@/lib/price";
import {
  DISH_PHOTO_ACCEPT,
  validateDishPhotoFile,
} from "@/lib/upload-validation";
import styles from "./page.module.css";

// ─── Constants ──────────────────────────────────────────────────────────────────

type LocalPhoto = { id: string; file: File; preview: string };

const MAX_PHOTOS = 8;
const DRAFT_KEY = "7eats:new-meal-draft:v1";

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

function readDraft(): MealDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  return parseMealDraft(raw);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewDishPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  // Seeded with SSR-safe empty defaults; the actual draft (if any) is only
  // known client-side, so it's restored in an effect below rather than a
  // lazy useState initializer — reading localStorage there would make the
  // client's first render disagree with the server-rendered HTML.
  const [draftRestored, setDraftRestored] = useState(false);

  const [form, setForm] = useState(EMPTY_MEAL_FORM);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [nutrition, setNutrition] = useState(EMPTY_MEAL_NUTRITION);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [noneApplies, setNoneApplies] = useState(false);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoIdRef = useRef(0);
  const photosRef = useRef<LocalPhoto[]>([]);

  const hasPhoto = photos.length > 0;

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const p of photosRef.current) URL.revokeObjectURL(p.preview);
    };
  }, []);

  // Client-only: restore a saved draft after mount so the first render still
  // matches the server-rendered (empty) HTML.
  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    setForm(draft.form);
    setIngredients(draft.ingredients);
    setNutrition(draft.nutrition);
    setAllergens(draft.allergens);
    setNoneApplies(draft.noneApplies);
    setDraftRestored(true);
  }, []);

  // Autosave the in-progress meal to this browser so a closed tab or crash
  // doesn't lose the cook's progress. Photos are intentionally excluded —
  // File objects aren't serializable, so they're re-attached on resume.
  const draftSnapshot: MealDraft = {
    form,
    ingredients,
    nutrition,
    allergens,
    noneApplies,
  };
  const debouncedDraft = useDebounce(draftSnapshot, 400);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isEmptyMealDraft(debouncedDraft)) {
      window.localStorage.removeItem(DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(debouncedDraft));
  }, [debouncedDraft]);

  function discardDraft() {
    window.localStorage.removeItem(DRAFT_KEY);
    setForm(EMPTY_MEAL_FORM);
    setIngredients([]);
    setNutrition(EMPTY_MEAL_NUTRITION);
    setAllergens([]);
    setNoneApplies(false);
    setPhotos((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.preview);
      return [];
    });
    setStep(1);
  }

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length;
      if (room <= 0) {
        toast.error(`You can add up to ${MAX_PHOTOS} photos.`);
        return prev;
      }
      const next = [...prev];
      let skippedForLimit = false;
      for (const file of files) {
        if (next.length - prev.length >= room) {
          skippedForLimit = true;
          break;
        }
        const err = validateDishPhotoFile(file);
        if (err) {
          toast.error(err);
          continue;
        }
        photoIdRef.current += 1;
        next.push({
          id: `photo-${photoIdRef.current}`,
          file,
          preview: URL.createObjectURL(file),
        });
      }
      if (skippedForLimit) {
        toast.error(`You can add up to ${MAX_PHOTOS} photos.`);
      }
      return next;
    });
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    addFiles(files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    addFiles(files);
  }

  async function uploadPhotos(dishId: string) {
    let allOk = true;
    for (let i = 0; i < photos.length; i++) {
      const fd = new FormData();
      fd.set("photo", photos[i].file);
      fd.set("isPrimary", i === 0 ? "true" : "false");
      const res = await fetch(`/api/business/dishes/${dishId}/photos/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) allOk = false;
    }
    return allOk;
  }

  function toggleAllergen(allergen: string) {
    if (noneApplies) setNoneApplies(false);
    setAllergens((prev) =>
      prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen],
    );
  }

  function handleNoneApplies() {
    setNoneApplies((prev) => {
      if (!prev) setAllergens([]);
      return !prev;
    });
  }

  function handleStep1Continue() {
    if (ingredients.length === 0) {
      setIngredients([{ id: `ing-${Date.now()}`, name: "" }]);
    }
    setStep(2);
  }

  async function handleCreate() {
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
        const uploaded = await uploadPhotos(dishId);
        if (!uploaded) {
          mealToastError(
            "Meal created but some photos failed to upload. Add them from the edit page.",
          );
        }
      }

      window.localStorage.removeItem(DRAFT_KEY);
      mealToastSuccess("Meal created");
      router.push("/business/listings");
    } catch {
      mealToastError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    router.push("/business/listings");
  }

  function handlePriceChange(value: string) {
    if (isPriceKeystroke(value)) {
      setForm((f) => ({ ...f, price: value }));
    }
  }

  const stepRequirements =
    step === 1
      ? step1Requirements(form, hasPhoto)
      : step2Requirements(ingredients, allergens, noneApplies);
  const stepComplete = stepRequirements.every((r) => r.met);
  const nextRequirement = stepRequirements.find((r) => !r.met);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>New meal</h1>
      </div>

      {draftRestored && (
        <div className={styles.draftBanner}>
          <span>Resumed your saved draft.</span>
          <button type="button" onClick={discardDraft}>
            Discard and start over
          </button>
        </div>
      )}

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
                maxLength={MEAL_DESCRIPTION_MAX}
                placeholder="Describe the dish."
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
              <span
                className={`${styles.charCount} ${
                  form.description.length >= MEAL_DESCRIPTION_MAX
                    ? styles.charCountLimit
                    : ""
                }`}
              >
                {form.description.length}/{MEAL_DESCRIPTION_MAX}
              </span>
            </div>

            <div className={styles.formGroup}>
              <div className={styles.photoLabelRow}>
                <span className={styles.formLabel}>
                  Photos <span className={styles.required}>*</span>
                </span>
                <span className={styles.photoCount}>
                  {photos.length} / {MAX_PHOTOS}
                </span>
              </div>
              <p className={styles.sectionHint}>
                The first photo is the cover. JPG, PNG, or WebP · max 10 MB.
              </p>

              {photos.length === 0 ? (
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
                  <div className={styles.dropzoneEmpty}>
                    <Upload size={22} strokeWidth={1.5} />
                    <span>Drag and drop or click to upload</span>
                    <span className={styles.dropzoneHint}>
                      Add up to {MAX_PHOTOS} photos
                    </span>
                  </div>
                </button>
              ) : (
                // biome-ignore lint/a11y/noStaticElementInteractions: drop target
                <div
                  className={styles.photoStrip}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  {photos.map((photo, i) => (
                    <div key={photo.id} className={styles.photoThumb}>
                      {/* biome-ignore lint/performance/noImgElement: local file preview */}
                      <img
                        src={photo.preview}
                        alt={i === 0 ? "Cover preview" : "Dish photo"}
                        className={styles.photoImg}
                      />
                      {i === 0 && (
                        <span className={styles.coverTag}>Cover</span>
                      )}
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
                    <button
                      type="button"
                      className={styles.photoAdd}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus size={15} className={styles.photoAddIcon} />
                      <span>Add photo</span>
                    </button>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={DISH_PHOTO_ACCEPT}
                multiple
                hidden
                onChange={handlePhotoSelect}
              />
            </div>

            {nextRequirement && (
              <div className={styles.requirementsWrap}>
                <p className={styles.requirementsHeading}>To continue:</p>
                <RequirementsChecklist items={[nextRequirement]} />
              </div>
            )}

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
                disabled={!stepComplete}
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
                Add at least one ingredient. Names only, no amounts.
              </p>

              <IngredientsInput
                ingredients={ingredients}
                onChange={setIngredients}
              />
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

            {nextRequirement && (
              <div className={styles.requirementsWrap}>
                <p className={styles.requirementsHeading}>To continue:</p>
                <RequirementsChecklist items={[nextRequirement]} />
              </div>
            )}

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
                disabled={!stepComplete || submitting}
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
