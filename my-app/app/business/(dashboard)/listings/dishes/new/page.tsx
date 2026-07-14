"use client";

import { ImagePlus, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import IngredientsInput, {
  type IngredientRow,
} from "@/app/components/IngredientsInput";
import RequirementsChecklist from "@/app/components/RequirementsChecklist";
import {
  draftMealRequirements,
  EMPTY_MEAL_FORM,
  EMPTY_MEAL_NUTRITION,
  isEmptyMealDraft,
  MEAL_DESCRIPTION_MAX,
  type MealDraft,
  parseMealDraft,
  publishMealRequirements,
} from "@/lib/dishes/new-meal-form";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { mealToastError, mealToastSuccess } from "@/lib/meal-toast";
import { isPriceKeystroke } from "@/lib/price";
import {
  DISH_PHOTO_ACCEPT,
  validateDishPhotoFile,
} from "@/lib/upload-validation";
import styles from "./page.module.css";

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

function readDraft(): MealDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  return parseMealDraft(raw);
}

export default function NewDishPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftHint, setDraftHint] = useState(false);

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

  function discardLocalDraft() {
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
    setDraftRestored(false);
    setDraftHint(false);
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
    if (!noneApplies) {
      setAllergens([]);
      setNoneApplies(true);
    } else {
      setNoneApplies(false);
    }
  }

  function buildPayload(status: "active" | "draft") {
    const priceNum = Number(form.price);
    const num = (v: string) => {
      const n = Number(v);
      return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
    };

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      status,
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
    };

    if (form.price.trim() !== "" && Number.isFinite(priceNum)) {
      body.price = Math.round(priceNum * 100) / 100;
    }

    return body;
  }

  async function submitMeal(status: "active" | "draft") {
    setSubmitting(true);
    try {
      const res = await fetch("/api/business/dishes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload(status)),
      });
      const data = await res.json();
      if (!res.ok) {
        mealToastError(
          data.error ??
            (status === "draft"
              ? "Could not save draft."
              : "Could not create the meal."),
        );
        return;
      }

      const dishId: string | undefined = data.data?.id;
      if (dishId && photos.length > 0) {
        const uploaded = await uploadPhotos(dishId);
        if (!uploaded) {
          mealToastError(
            status === "draft"
              ? "Draft saved but some photos failed. Add them from the draft later."
              : "Meal created but some photos failed to upload. Add them from the edit page.",
          );
        }
      }

      window.localStorage.removeItem(DRAFT_KEY);
      mealToastSuccess(status === "draft" ? "Draft saved" : "Meal created");
      // Hard navigation so the Meals tab reads ?status=draft cleanly.
      window.location.assign(
        status === "draft"
          ? "/business/listings?status=draft"
          : "/business/listings",
      );
    } catch {
      mealToastError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSaveDraft() {
    const reqs = draftMealRequirements(form);
    if (!reqs.every((r) => r.met)) {
      setDraftHint(true);
      return;
    }
    setDraftHint(false);
    void submitMeal("draft");
  }

  function handleCreate() {
    void submitMeal("active");
  }

  function handleCancel() {
    router.push("/business/listings");
  }

  function handlePriceChange(value: string) {
    if (isPriceKeystroke(value)) {
      setForm((f) => ({ ...f, price: value }));
    }
  }

  const publishReqs = publishMealRequirements(
    form,
    hasPhoto,
    ingredients,
    allergens,
    noneApplies,
  );
  const publishComplete = publishReqs.every((r) => r.met);
  const nextPublishRequirement = publishReqs.find((r) => !r.met);

  const draftReqs = draftMealRequirements(form);
  const nextDraftRequirement = draftReqs.find((r) => !r.met);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>New meal</h1>
        <p className={styles.sectionHint} style={{ margin: 0 }}>
          Save a draft anytime to finish on another device — photos can wait.
        </p>
      </div>

      {draftRestored && (
        <div className={styles.draftBanner}>
          <span>Resumed your browser draft.</span>
          <button type="button" onClick={discardLocalDraft}>
            Discard and start over
          </button>
        </div>
      )}

      <div className={styles.content}>
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
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
              Required to publish. Skip for now if you&apos;ll upload from your
              phone later. JPG, PNG, or WebP · max 10 MB.
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
                    {i === 0 && <span className={styles.coverTag}>Cover</span>}
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

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              Ingredients <span className={styles.required}>*</span>
            </h3>
            <p className={styles.sectionHint}>
              Add at least one ingredient to publish. Names only, no amounts.
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
                <label htmlFor="allergen-none" className={styles.allergenLabel}>
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

          {(nextPublishRequirement || (draftHint && nextDraftRequirement)) && (
            <div className={styles.requirementsWrap}>
              <p className={styles.requirementsHeading}>
                {draftHint && nextDraftRequirement
                  ? "To save draft:"
                  : "To publish:"}
              </p>
              <RequirementsChecklist
                items={
                  draftHint && nextDraftRequirement
                    ? [nextDraftRequirement]
                    : nextPublishRequirement
                      ? [nextPublishRequirement]
                      : []
                }
              />
            </div>
          )}

          <div className={styles.formActions}>
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
              className={styles.secondaryBtn}
              disabled={submitting}
              onClick={handleSaveDraft}
            >
              {submitting ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              disabled={!publishComplete || submitting}
              onClick={handleCreate}
            >
              {submitting ? "Creating…" : "Create meal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
