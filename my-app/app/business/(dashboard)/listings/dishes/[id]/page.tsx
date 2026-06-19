"use client";

import { Camera, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deepEqual } from "@/lib/forms/use-dirty";
import {
  DISH_PHOTO_ACCEPT,
  validateDishPhotoFile,
} from "@/lib/upload-validation";
import {
  ALLERGENS,
  DishDetailProvider,
  type IngredientRow,
  type NutritionForm,
  useDishDetail,
} from "./_dish-detail-context";
import { PromotionsTab } from "./_promotions-tab";
import styles from "./page.module.css";

type Tab = "details" | "nutrition" | "promotions";

const MAX_PHOTOS = 8;
const DESCRIPTION_MAX = 500;

// ─── Details tab ──────────────────────────────────────────────────────────────

// A photo in the working set: either an existing server photo (has serverId)
// or a newly added local file (has file + a blob: preview url). Changes stay
// local until "Save changes" so leaving the page never mutates the dish.
type WorkingPhoto = {
  key: string;
  serverId?: string;
  url: string;
  file?: File;
};

function isBlobUrl(url: string): boolean {
  return url.startsWith("blob:");
}

function DetailsTab() {
  const { dishId, stats, form, photos, saveDetails, reload, loading } =
    useDishDetail();
  const router = useRouter();
  const [localForm, setLocalForm] = useState({
    name: "",
    price: "",
    description: "",
    status: "active" as "active" | "inactive",
  });
  const [workingPhotos, setWorkingPhotos] = useState<WorkingPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoKeyRef = useRef(0);
  const workingRef = useRef<WorkingPhoto[]>([]);

  useEffect(() => {
    workingRef.current = workingPhotos;
  }, [workingPhotos]);

  // Revoke any object URLs still held when the tab unmounts.
  useEffect(() => {
    return () => {
      for (const p of workingRef.current) {
        if (p.file && isBlobUrl(p.url)) URL.revokeObjectURL(p.url);
      }
    };
  }, []);

  // Initialise (and re-sync after a save) from the loaded dish.
  useEffect(() => {
    if (form && !initialized) {
      setLocalForm(form);
      setWorkingPhotos((prev) => {
        for (const p of prev) {
          if (p.file && isBlobUrl(p.url)) URL.revokeObjectURL(p.url);
        }
        return photos.map((p) => ({ key: p.id, serverId: p.id, url: p.url }));
      });
      setInitialized(true);
    }
  }, [form, photos, initialized]);

  function addLocalPhotos(files: File[]) {
    if (files.length === 0) return;
    setWorkingPhotos((prev) => {
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
        photoKeyRef.current += 1;
        next.push({
          key: `new-${photoKeyRef.current}`,
          url: URL.createObjectURL(file),
          file,
        });
      }
      if (skippedForLimit) {
        toast.error(`You can add up to ${MAX_PHOTOS} photos.`);
      }
      return next;
    });
  }

  function removeLocalPhoto(key: string) {
    setWorkingPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target?.file && isBlobUrl(target.url)) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((p) => p.key !== key);
    });
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    addLocalPhotos(files);
  }

  function handleCancel() {
    router.push("/business/listings");
  }

  async function handleSave() {
    if (workingPhotos.length === 0) {
      toast.error("Add at least one photo before saving.");
      return;
    }
    if (!localForm.name.trim()) {
      toast.error("Enter a dish name.");
      return;
    }
    if (localForm.description.length > DESCRIPTION_MAX) {
      toast.error(
        `Description must be ${DESCRIPTION_MAX} characters or fewer.`,
      );
      return;
    }

    setSaving(true);
    try {
      // 1. Delete server photos the cook removed from the working set.
      const survivingIds = new Set(
        workingPhotos.filter((p) => p.serverId).map((p) => p.serverId),
      );
      const toDelete = photos.filter((p) => !survivingIds.has(p.id));
      for (const p of toDelete) {
        await fetch(`/api/business/dishes/${dishId}/photos/${p.id}`, {
          method: "DELETE",
        });
      }

      // 2. Upload newly added photos in order. If no existing photo survives,
      //    the first new upload becomes the primary/cover.
      const noneSurvive = survivingIds.size === 0;
      const firstNewIdx = workingPhotos.findIndex((p) => p.file);
      for (let i = 0; i < workingPhotos.length; i++) {
        const wp = workingPhotos[i];
        if (!wp.file) continue;
        const fd = new FormData();
        fd.set("photo", wp.file);
        fd.set(
          "isPrimary",
          noneSurvive && i === firstNewIdx ? "true" : "false",
        );
        const res = await fetch(
          `/api/business/dishes/${dishId}/photos/upload`,
          { method: "POST", body: fd },
        );
        if (!res.ok) {
          toast.error("A photo failed to upload.");
        }
      }

      // 3. Save the text details (this reloads the dish).
      const ok = await saveDetails({
        name: localForm.name,
        price: localForm.price,
        description: localForm.description,
        status: localForm.status,
      });
      if (!ok) {
        toast.error("Could not save changes.");
        await reload();
        setInitialized(false);
        return;
      }
      toast.success("Changes saved.");
      router.push("/business/listings");
    } catch {
      toast.error("Could not save changes.");
      await reload();
      setInitialized(false);
    } finally {
      setSaving(false);
    }
  }

  // Dirty when the text fields changed, or photos were added/removed.
  const photosDirty =
    workingPhotos.some((p) => p.file) ||
    workingPhotos
      .filter((p) => p.serverId)
      .map((p) => p.serverId)
      .join(",") !== photos.map((p) => p.id).join(",");
  const formDirty = form ? !deepEqual(localForm, form) : false;
  const dirty = formDirty || photosDirty;

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
          <span className={styles.statLabel}>Avg qty / order</span>
          <span className={styles.statVal}>
            {stats.avgQtyPerOrder.toFixed(1)}
          </span>
        </div>
      </div>

      <div className={styles.overviewColumns}>
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
            <label htmlFor="f-description" className={styles.formLabel}>
              Description
            </label>
            <textarea
              id="f-description"
              className={styles.formTextarea}
              value={localForm.description}
              rows={6}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) =>
                setLocalForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.photoLabelRow}>
              <span className={styles.formLabel}>Photos</span>
              <span className={styles.photoCount}>
                {workingPhotos.length} / {MAX_PHOTOS}
              </span>
            </div>
            <div className={styles.photoStrip}>
              {workingPhotos.map((photo) => (
                <div key={photo.key} className={styles.photoThumb}>
                  {photo.file ? (
                    // biome-ignore lint/performance/noImgElement: local file preview
                    <img
                      src={photo.url}
                      alt="Dish preview"
                      className={styles.photoImg}
                    />
                  ) : (
                    <Image
                      src={photo.url}
                      alt="Dish photo"
                      fill
                      className={styles.photoImg}
                    />
                  )}
                  <button
                    type="button"
                    className={styles.photoRemove}
                    onClick={() => removeLocalPhoto(photo.key)}
                    aria-label="Remove photo"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {workingPhotos.length < MAX_PHOTOS && (
                <>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept={DISH_PHOTO_ACCEPT}
                    multiple
                    hidden
                    onChange={handlePhotoSelect}
                  />
                  <button
                    type="button"
                    className={styles.photoAdd}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Camera size={15} className={styles.photoAddIcon} />
                    <span>Add photo</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={workingPhotos.length === 0 || saving || !dirty}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {workingPhotos.length === 0 && (
              <span className={styles.saveHint}>
                Add at least one photo to save.
              </span>
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
  const router = useRouter();
  const [otherChecked, setOtherChecked] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [noneApplies, setNoneApplies] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const baselineRef = useRef<{
    ingredients: IngredientRow[];
    nutrition: NutritionForm;
  } | null>(null);

  useEffect(() => {
    if (!loading && !initialized) {
      baselineRef.current = { ingredients, nutrition };
      setInitialized(true);
    }
  }, [loading, initialized, ingredients, nutrition]);

  const dirty = baselineRef.current
    ? !deepEqual(
        { ingredients, nutrition, otherChecked, otherText, noneApplies },
        {
          ingredients: baselineRef.current.ingredients,
          nutrition: baselineRef.current.nutrition,
          otherChecked: false,
          otherText: "",
          noneApplies: false,
        },
      )
    : false;

  function addIngredient() {
    setIngredients((prev) => [...prev, { id: `ing-${Date.now()}`, name: "" }]);
  }

  function removeIngredient(id: string) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  function updateIngredient(id: string, value: string) {
    setIngredients((prev) =>
      prev.map((i) => (i.id === id ? { ...i, name: value } : i)),
    );
  }

  function toggleAllergen(allergen: string) {
    if (noneApplies) setNoneApplies(false);
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
    if (ingredients.some((i) => !i.name.trim())) {
      toast.error("All ingredients must have a name.");
      return;
    }
    if (!noneApplies && nutrition.allergens.length === 0 && !otherChecked) {
      toast.error("Select allergens or check “None of these apply”.");
      return;
    }
    const ok = await saveNutrition({
      ingredients,
      nutrition,
      otherChecked,
      otherText,
      noneApplies,
    });
    if (!ok) {
      toast.error("Could not save nutrition.");
      return;
    }
    toast.success("Nutrition saved.");
    router.push("/business/listings");
  }

  if (loading && !initialized) {
    return <p className={styles.emptyNote}>Loading nutrition…</p>;
  }

  return (
    <div className={styles.nutritionTab}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Ingredients</h3>

        {ingredients.length > 0 && (
          <div className={styles.ingListSimple}>
            {ingredients.map((ing) => (
              <div key={ing.id} className={styles.ingRowSimple}>
                <input
                  type="text"
                  aria-label="Ingredient name"
                  className={`${styles.ingInput} ${styles.ingNameInput}`}
                  value={ing.name}
                  placeholder="e.g. Tomato paste"
                  onChange={(e) => updateIngredient(ing.id, e.target.value)}
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
                    disabled={noneApplies && !isOther}
                    onChange={() => toggleAllergen(allergen)}
                  />
                  {allergen}
                </label>
              );
            })}
            <label htmlFor="allergen-none" className={styles.allergenLabel}>
              <input
                id="allergen-none"
                type="checkbox"
                className={styles.allergenCheck}
                checked={noneApplies}
                onChange={() => {
                  setNoneApplies((prev) => {
                    if (!prev) {
                      setNutrition((n) => ({ ...n, allergens: [] }));
                      setOtherChecked(false);
                      setOtherText("");
                    }
                    return !prev;
                  });
                }}
              />
              None of these apply
            </label>
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

      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={() => router.push("/business/listings")}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={!dirty}
        >
          Save changes
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
        <p className={styles.emptyNote}>Loading dish…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.emptyNote}>{error}</p>
      </div>
    );
  }

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
        {tab === "promotions" && <PromotionsTab />}
      </div>
    </div>
  );
}
