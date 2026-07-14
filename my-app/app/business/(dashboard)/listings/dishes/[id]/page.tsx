"use client";

import { Camera, ImageOff, UtensilsCrossed, X } from "lucide-react";
import { useParams } from "next/navigation";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import IngredientsInput from "@/app/components/IngredientsInput";
import RequirementsChecklist from "@/app/components/RequirementsChecklist";
import { publishMealRequirements } from "@/lib/dishes/new-meal-form";
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
import { DishDetailSkeleton } from "./_skeletons";
import styles from "./page.module.css";

type TopTab = "meal" | "promotions";
type MealSectionId = "details" | "nutrition";

const MAX_PHOTOS = 8;
const DESCRIPTION_MAX = 500;

type SaveOpts = { publish?: boolean };

type DetailsPublishSnapshot = {
  name: string;
  price: string;
  description: string;
  photoCount: number;
};

type NutritionPublishSnapshot = {
  ingredients: IngredientRow[];
  allergens: string[];
  noneApplies: boolean;
};

export type DetailsSectionHandle = {
  dirty: boolean;
  photoCount: number;
  save: (opts?: SaveOpts) => Promise<boolean>;
};

export type NutritionSectionHandle = {
  dirty: boolean;
  save: (opts?: SaveOpts) => Promise<boolean>;
};

// A photo in the working set: either an existing server photo (has serverId)
// or a newly added local file (has file + a blob: preview url). Changes stay
// local until save so leaving the page never mutates the dish.
type WorkingPhoto = {
  key: string;
  serverId?: string;
  url: string;
  file?: File;
};

function isBlobUrl(url: string): boolean {
  return url.startsWith("blob:");
}

// ─── Details section ──────────────────────────────────────────────────────────

const DetailsSection = forwardRef<
  DetailsSectionHandle,
  {
    onDirtyChange?: (dirty: boolean) => void;
    onPhotoCountChange?: (n: number) => void;
    onPublishSnapshotChange?: (snapshot: DetailsPublishSnapshot) => void;
  }
>(function DetailsSection(
  { onDirtyChange, onPhotoCountChange, onPublishSnapshotChange },
  ref,
) {
  const { dishId, stats, form, photos, saveDetails, reload, loading } =
    useDishDetail();
  const [localForm, setLocalForm] = useState({
    name: "",
    price: "",
    description: "",
    status: "active" as "active" | "inactive" | "draft",
  });
  const [workingPhotos, setWorkingPhotos] = useState<WorkingPhoto[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [fileDragActive, setFileDragActive] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoKeyRef = useRef(0);
  const workingRef = useRef<WorkingPhoto[]>([]);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    workingRef.current = workingPhotos;
  }, [workingPhotos]);

  useEffect(() => {
    return () => {
      for (const p of workingRef.current) {
        if (p.file && isBlobUrl(p.url)) URL.revokeObjectURL(p.url);
      }
    };
  }, []);

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

  const photosDirty =
    workingPhotos.some((p) => p.file) ||
    workingPhotos
      .filter((p) => p.serverId)
      .map((p) => p.serverId)
      .join(",") !== photos.map((p) => p.id).join(",");
  const formDirty = form ? !deepEqual(localForm, form) : false;
  const dirty = formDirty || photosDirty;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    onPhotoCountChange?.(workingPhotos.length);
  }, [workingPhotos.length, onPhotoCountChange]);

  useEffect(() => {
    onPublishSnapshotChange?.({
      name: localForm.name,
      price: localForm.price,
      description: localForm.description,
      photoCount: workingPhotos.length,
    });
  }, [
    localForm.name,
    localForm.price,
    localForm.description,
    workingPhotos.length,
    onPublishSnapshotChange,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      get dirty() {
        return dirty;
      },
      get photoCount() {
        return workingPhotos.length;
      },
      async save(opts: SaveOpts = {}) {
        const isDraft = localForm.status === "draft" && !opts.publish;
        if (!isDraft && workingPhotos.length === 0) {
          toast.error("Add at least one photo before saving.");
          return false;
        }
        if (!localForm.name.trim()) {
          toast.error("Enter a dish name.");
          return false;
        }
        if (localForm.description.length > DESCRIPTION_MAX) {
          toast.error(
            `Description must be ${DESCRIPTION_MAX} characters or fewer.`,
          );
          return false;
        }
        if (opts.publish) {
          const priceNum = Number(localForm.price);
          if (
            !localForm.price.trim() ||
            !Number.isFinite(priceNum) ||
            priceNum <= 0
          ) {
            toast.error("Enter a valid price before publishing.");
            return false;
          }
          if (!localForm.description.trim()) {
            toast.error("Add a description before publishing.");
            return false;
          }
        }

        try {
          const survivingIds = new Set(
            workingPhotos.filter((p) => p.serverId).map((p) => p.serverId),
          );
          const toDelete = photos.filter((p) => !survivingIds.has(p.id));
          for (const p of toDelete) {
            await fetch(`/api/business/dishes/${dishId}/photos/${p.id}`, {
              method: "DELETE",
            });
          }

          const orderedIds: string[] = [];
          for (const wp of workingPhotos) {
            if (wp.serverId) {
              orderedIds.push(wp.serverId);
              continue;
            }
            if (!wp.file) continue;
            const fd = new FormData();
            fd.set("photo", wp.file);
            fd.set("isPrimary", "false");
            const res = await fetch(
              `/api/business/dishes/${dishId}/photos/upload`,
              { method: "POST", body: fd },
            );
            if (!res.ok) {
              toast.error("A photo failed to upload.");
              continue;
            }
            const json = await res.json().catch(() => null);
            if (json?.data?.id) orderedIds.push(json.data.id as string);
          }

          for (let i = 0; i < orderedIds.length; i++) {
            await fetch(
              `/api/business/dishes/${dishId}/photos/${orderedIds[i]}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sortOrder: i, isPrimary: i === 0 }),
              },
            );
          }

          const nextStatus = opts.publish ? "active" : localForm.status;
          const ok = await saveDetails({
            name: localForm.name,
            price: localForm.price,
            description: localForm.description,
            status: nextStatus,
          });
          if (!ok) {
            toast.error("Could not save changes.");
            await reload();
            setInitialized(false);
            return false;
          }
          return true;
        } catch {
          toast.error("Could not save changes.");
          await reload();
          setInitialized(false);
          return false;
        }
      },
    }),
    [dirty, workingPhotos, localForm, photos, dishId, saveDetails, reload],
  );

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

  function reorderPhotos(from: number, to: number) {
    if (from === to) return;
    setWorkingPhotos((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleThumbDragStart(idx: number) {
    setDragIndex(idx);
    setOverIndex(idx);
  }

  function handleThumbDragEnter(idx: number) {
    if (dragIndex === null) return;
    setOverIndex(idx);
  }

  function handleThumbDrop(idx: number) {
    if (dragIndex !== null) reorderPhotos(dragIndex, idx);
    setDragIndex(null);
    setOverIndex(null);
  }

  function handleThumbDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  function handleThumbKeyDown(e: React.KeyboardEvent, idx: number) {
    let to = idx;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = idx - 1;
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") to = idx + 1;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = workingPhotos.length - 1;
    else return;
    e.preventDefault();
    if (to < 0 || to >= workingPhotos.length || to === idx) return;
    reorderPhotos(idx, to);
    requestAnimationFrame(() => {
      stripRef.current
        ?.querySelector<HTMLElement>(`[data-thumb-index="${to}"]`)
        ?.focus();
    });
  }

  function isExternalFileDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes("Files");
  }

  function handleStripDragOver(e: React.DragEvent) {
    if (dragIndex !== null) return;
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!fileDragActive) setFileDragActive(true);
  }

  function handleStripDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setFileDragActive(false);
  }

  function handleStripDrop(e: React.DragEvent) {
    if (dragIndex !== null) return;
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    setFileDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length === 0) {
      toast.error("Drop image files only.");
      return;
    }
    addLocalPhotos(files);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    addLocalPhotos(files);
  }

  if (loading && !initialized) {
    return <p className={styles.loadingNote}>Loading dish…</p>;
  }

  const descCount = localForm.description.length;
  const descOver = descCount > DESCRIPTION_MAX;

  return (
    <div className={styles.sectionBody}>
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

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Dish details</h3>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label htmlFor="f-name" className={styles.formLabel}>
              Name <span className={styles.required}>*</span>
            </label>
            <input
              id="f-name"
              name="name"
              type="text"
              autoComplete="off"
              spellCheck={false}
              className={styles.formInput}
              value={localForm.name}
              placeholder="e.g. Jollof rice with chicken"
              onChange={(e) =>
                setLocalForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="f-price" className={styles.formLabel}>
              Price per meal
            </label>
            <div className={styles.adornLead}>
              <span className={styles.adornLeadUnit}>$</span>
              <input
                id="f-price"
                name="price"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className={styles.formInput}
                value={localForm.price}
                placeholder="0.00"
                onChange={(e) =>
                  setLocalForm((f) => ({ ...f, price: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="f-description" className={styles.formLabel}>
            Description
          </label>
          <div className={styles.textareaWrap}>
            <textarea
              id="f-description"
              name="description"
              className={styles.formTextarea}
              value={localForm.description}
              rows={5}
              maxLength={DESCRIPTION_MAX}
              placeholder="What makes this dish special?"
              onChange={(e) =>
                setLocalForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <span
              className={`${styles.charCount} ${
                descOver ? styles.charCountLimit : ""
              }`}
            >
              {descCount} / {DESCRIPTION_MAX}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.photoLabelRow}>
            <h3 className={styles.cardTitle}>Photos</h3>
            <span className={styles.photoCount}>
              {workingPhotos.length} / {MAX_PHOTOS}
            </span>
          </div>
          <p className={styles.cardDesc}>
            Drag photos to reorder. The first is the cover diners see. Drop
            images here or use Add photo (up to {MAX_PHOTOS}).
          </p>
        </div>

        {workingPhotos.length === 0 ? (
          <div className={styles.emptyState}>
            <ImageOff size={22} className={styles.emptyIcon} />
            <p className={styles.emptyText}>No photos yet</p>
            <p className={styles.emptySub}>
              Add at least one photo before saving. It&rsquo;s the first thing
              diners notice.
            </p>
          </div>
        ) : null}

        {/* biome-ignore lint/a11y/noStaticElementInteractions: the strip is a
        supplementary file drop zone; the accessible upload path is the
        "Add photo" button below. */}
        <div
          ref={stripRef}
          className={`${styles.photoStrip} ${
            fileDragActive ? styles.photoStripDropActive : ""
          }`}
          onDragOver={handleStripDragOver}
          onDragLeave={handleStripDragLeave}
          onDrop={handleStripDrop}
        >
          {/* biome-ignore-start lint/a11y/useSemanticElements: reorderable photo
          thumbnails use role="button" with keyboard support; a native <button>
          can't wrap the draggable image and nest the remove button. */}
          {workingPhotos.map((photo, idx) => (
            <div
              key={photo.key}
              data-thumb-index={idx}
              role="button"
              tabIndex={0}
              aria-label={`Photo ${idx + 1} of ${workingPhotos.length}${
                idx === 0 ? " (cover)" : ""
              }. Use arrow keys to reorder.`}
              className={`${styles.photoThumb} ${
                dragIndex === idx ? styles.photoThumbDragging : ""
              } ${
                overIndex === idx && dragIndex !== null && dragIndex !== idx
                  ? styles.photoThumbDropTarget
                  : ""
              }`}
              draggable
              onDragStart={() => handleThumbDragStart(idx)}
              onDragEnter={() => handleThumbDragEnter(idx)}
              onDragOver={(e) => {
                if (dragIndex !== null) e.preventDefault();
              }}
              onDrop={(e) => {
                if (dragIndex !== null) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleThumbDrop(idx);
                }
              }}
              onDragEnd={handleThumbDragEnd}
              onKeyDown={(e) => handleThumbKeyDown(e, idx)}
            >
              {photo.file ? (
                // biome-ignore lint/performance/noImgElement: local file preview
                <img
                  src={photo.url}
                  alt="Dish preview"
                  className={styles.photoImg}
                  draggable={false}
                />
              ) : (
                // biome-ignore lint/performance/noImgElement: R2 CDN dish photo
                <img
                  src={photo.url}
                  alt="Dish"
                  className={styles.photoImg}
                  draggable={false}
                />
              )}
              {idx === 0 && <span className={styles.coverTag}>Cover</span>}
              <button
                type="button"
                className={styles.photoRemove}
                onClick={() => removeLocalPhoto(photo.key)}
                aria-label="Remove photo"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {/* biome-ignore-end lint/a11y/useSemanticElements: end reorder thumbnails */}
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
                <Camera size={16} className={styles.photoAddIcon} />
                <span>Add photo</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Nutrition section ────────────────────────────────────────────────────────

const NutritionSection = forwardRef<
  NutritionSectionHandle,
  {
    onDirtyChange?: (dirty: boolean) => void;
    onPublishSnapshotChange?: (snapshot: NutritionPublishSnapshot) => void;
  }
>(function NutritionSection({ onDirtyChange, onPublishSnapshotChange }, ref) {
  const {
    form,
    ingredients,
    setIngredients,
    nutrition,
    setNutrition,
    saveNutrition,
    loading,
  } = useDishDetail();
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

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    const allergens = [
      ...nutrition.allergens,
      ...(otherChecked ? [otherText.trim() || "Other"] : []),
    ];
    onPublishSnapshotChange?.({
      ingredients,
      allergens,
      noneApplies,
    });
  }, [
    ingredients,
    nutrition.allergens,
    noneApplies,
    otherChecked,
    otherText,
    onPublishSnapshotChange,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      get dirty() {
        return dirty;
      },
      async save(opts: SaveOpts = {}) {
        const isDraftSave = form?.status === "draft" && !opts.publish;
        const namedIngredients = ingredients.filter((i) => i.name.trim());

        if (!isDraftSave && ingredients.some((i) => !i.name.trim())) {
          toast.error("All ingredients must have a name.");
          return false;
        }

        if (opts.publish) {
          if (namedIngredients.length < 1) {
            toast.error("Add at least one ingredient before publishing.");
            return false;
          }
        }

        if (
          !isDraftSave &&
          !noneApplies &&
          nutrition.allergens.length === 0 &&
          !otherChecked
        ) {
          toast.error("Select allergens or check “None of these apply”.");
          return false;
        }

        const ok = await saveNutrition({
          ingredients: isDraftSave ? namedIngredients : ingredients,
          nutrition,
          otherChecked,
          otherText,
          noneApplies,
        });
        if (!ok) {
          toast.error("Could not save nutrition.");
          return false;
        }
        return true;
      },
    }),
    [
      dirty,
      ingredients,
      form?.status,
      noneApplies,
      nutrition,
      otherChecked,
      otherText,
      saveNutrition,
    ],
  );

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

  if (loading && !initialized) {
    return <p className={styles.loadingNote}>Loading nutrition…</p>;
  }

  const macros: {
    key: keyof Pick<NutritionForm, "calories" | "protein" | "carbs" | "fat">;
    label: string;
    unit: string;
  }[] = [
    { key: "calories", label: "Calories", unit: "kcal" },
    { key: "protein", label: "Protein", unit: "g" },
    { key: "carbs", label: "Carbs", unit: "g" },
    { key: "fat", label: "Fat", unit: "g" },
  ];

  return (
    <div className={styles.sectionBody}>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Ingredients</h3>
          <p className={styles.cardDesc}>
            List what goes into the dish so diners with restrictions can choose
            confidently.
          </p>
        </div>

        <IngredientsInput
          ingredients={ingredients}
          onChange={setIngredients}
          emptyState={
            <div className={styles.emptyState}>
              <UtensilsCrossed size={22} className={styles.emptyIcon} />
              <p className={styles.emptyText}>No ingredients yet</p>
              <p className={styles.emptySub}>
                Add each ingredient one at a time, or paste a comma-separated
                list. Diners use this to avoid allergens.
              </p>
            </div>
          }
        />
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Nutrition per serving</h3>
        </div>
        <div className={styles.macroGrid}>
          {macros.map((m) => (
            <div key={m.key} className={styles.formGroup}>
              <label htmlFor={`f-${m.key}`} className={styles.formLabel}>
                {m.label}
              </label>
              <div className={styles.adorn}>
                <input
                  id={`f-${m.key}`}
                  name={m.key}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  autoComplete="off"
                  className={styles.formInput}
                  value={nutrition[m.key]}
                  onChange={(e) =>
                    setNutrition((n) => ({
                      ...n,
                      [m.key]: Number(e.target.value),
                    }))
                  }
                />
                <span className={styles.adornUnit}>{m.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Allergens</h3>
          <p className={styles.cardDesc}>
            Select everything this dish contains, or mark that none apply.
          </p>
        </div>

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
                className={styles.allergenChip}
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
          <label htmlFor="allergen-none" className={styles.allergenChip}>
            <input
              id="allergen-none"
              type="checkbox"
              className={styles.allergenCheck}
              checked={noneApplies}
              onChange={() => {
                // Keep sibling updates outside the setState updater — nested
                // setNutrition here runs during render and throws in React 19.
                if (!noneApplies) {
                  setNutrition((n) => ({ ...n, allergens: [] }));
                  setOtherChecked(false);
                  setOtherText("");
                  setNoneApplies(true);
                } else {
                  setNoneApplies(false);
                }
              }}
            />
            None of these apply
          </label>
        </div>
        {otherChecked && (
          <input
            type="text"
            aria-label="Specify other allergen"
            autoComplete="off"
            className={`${styles.formInput} ${styles.otherInput}`}
            value={otherText}
            placeholder="Specify allergen, e.g. Sesame"
            onChange={(e) => setOtherText(e.target.value)}
          />
        )}
      </div>
    </div>
  );
});

// ─── Meal editor (scroll sections + shared footer) ────────────────────────────

const MEAL_SECTIONS: { id: MealSectionId; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "nutrition", label: "Ingredients & nutrition" },
];

function MealEditor() {
  const { form } = useDishDetail();
  const [activeSection, setActiveSection] = useState<MealSectionId>("details");
  const [saving, setSaving] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [nutritionDirty, setNutritionDirty] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [detailsSnapshot, setDetailsSnapshot] =
    useState<DetailsPublishSnapshot>({
      name: "",
      price: "",
      description: "",
      photoCount: 0,
    });
  const [nutritionSnapshot, setNutritionSnapshot] =
    useState<NutritionPublishSnapshot>({
      ingredients: [],
      allergens: [],
      noneApplies: false,
    });

  const detailsRef = useRef<DetailsSectionHandle>(null);
  const nutritionRef = useRef<NutritionSectionHandle>(null);
  const detailsSectionRef = useRef<HTMLDivElement>(null);
  const nutritionSectionRef = useRef<HTMLDivElement>(null);
  const visibleIds = useRef(new Set<MealSectionId>());

  const status = form?.status ?? "active";
  const isDraft = status === "draft";
  const dirty = detailsDirty || nutritionDirty;

  const publishReqs = useMemo(
    () =>
      publishMealRequirements(
        {
          name: detailsSnapshot.name,
          price: detailsSnapshot.price,
          description: detailsSnapshot.description,
        },
        detailsSnapshot.photoCount > 0,
        nutritionSnapshot.ingredients,
        nutritionSnapshot.allergens,
        nutritionSnapshot.noneApplies,
      ),
    [detailsSnapshot, nutritionSnapshot],
  );
  const publishReady = publishReqs.every((r) => r.met);
  const nextPublishRequirement = publishReqs.find((r) => !r.met);

  useEffect(() => {
    const ORDER: MealSectionId[] = ["details", "nutrition"];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id as MealSectionId;
          if (entry.isIntersecting) {
            visibleIds.current.add(id);
          } else {
            visibleIds.current.delete(id);
          }
        }
        for (const id of ORDER) {
          if (visibleIds.current.has(id)) {
            setActiveSection(id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -60% 0px", threshold: 0 },
    );
    const refs = [detailsSectionRef, nutritionSectionRef];
    for (const sectionRef of refs) {
      if (sectionRef.current) observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: MealSectionId) {
    const refMap: Record<
      MealSectionId,
      React.RefObject<HTMLDivElement | null>
    > = {
      details: detailsSectionRef,
      nutrition: nutritionSectionRef,
    };
    const el = refMap[id].current;
    if (!el) return;
    const scroller = el.closest("main");
    if (!scroller) return;
    const top =
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      16;
    scroller.scrollTo({ top, behavior: "smooth" });
  }

  function handleCancel() {
    window.location.assign(
      isDraft ? "/business/listings?status=draft" : "/business/listings",
    );
  }

  async function handleSave(opts: SaveOpts = {}) {
    // Capture save fns before awaits — a mid-save remount would clear the refs.
    const saveNutritionSection = nutritionRef.current?.save;
    const saveDetailsSection = detailsRef.current?.save;
    if (!saveNutritionSection || !saveDetailsSection) {
      toast.error("Editor not ready. Try again.");
      return;
    }

    setSaving(true);
    try {
      // Nutrition first: both saves refresh context, and nutrition state lives
      // there (would be wiped if details saved first). Details keeps a local
      // working copy of form + photos, so it survives the nutrition refresh.
      const nutritionOk = await saveNutritionSection(opts);
      if (!nutritionOk) return;

      const detailsOk = await saveDetailsSection(opts);
      if (!detailsOk) return;

      toast.success(
        opts.publish
          ? "Meal published"
          : isDraft
            ? "Draft saved"
            : "Changes saved.",
      );
      // Always leave the editor after save — drafts return to the Drafts tab.
      window.location.assign(
        opts.publish
          ? "/business/listings"
          : isDraft
            ? "/business/listings?status=draft"
            : "/business/listings",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.mealTab}>
      <div className={styles.layout}>
        <div className={styles.sections}>
          <div id="details" ref={detailsSectionRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>Details</h2>
            <DetailsSection
              ref={detailsRef}
              onDirtyChange={setDetailsDirty}
              onPhotoCountChange={setPhotoCount}
              onPublishSnapshotChange={setDetailsSnapshot}
            />
          </div>

          <div
            id="nutrition"
            ref={nutritionSectionRef}
            className={styles.section}
          >
            <h2 className={styles.sectionTitle}>Ingredients & nutrition</h2>
            <NutritionSection
              ref={nutritionRef}
              onDirtyChange={setNutritionDirty}
              onPublishSnapshotChange={setNutritionSnapshot}
            />
          </div>
        </div>

        <nav className={styles.sideNav} aria-label="Meal sections">
          {MEAL_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={`${styles.navItem} ${
                activeSection === s.id ? styles.navItemActive : ""
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {isDraft && nextPublishRequirement && (
        <div className={styles.requirementsWrap}>
          <p className={styles.requirementsHeading}>To publish:</p>
          <RequirementsChecklist items={[nextPublishRequirement]} />
        </div>
      )}

      <div className={styles.footer}>
        {!isDraft && photoCount === 0 ? (
          <span className={`${styles.footerHint} ${styles.footerHintError}`}>
            Add at least one photo to save.
          </span>
        ) : isDraft && !publishReady ? (
          <span className={styles.footerHint}>
            Finish the items above to publish. You can still save as a draft.
          </span>
        ) : (
          <span className={styles.footerHint} />
        )}
        <div className={styles.footerBtns}>
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
            className={isDraft ? styles.cancelBtn : styles.saveBtn}
            onClick={() => void handleSave()}
            disabled={
              (!isDraft && photoCount === 0) || saving || (!isDraft && !dirty)
            }
          >
            {saving && !isDraft && (
              <span className={styles.spinner} aria-hidden="true" />
            )}
            {saving ? "Saving…" : isDraft ? "Save draft" : "Save changes"}
          </button>
          {isDraft && (
            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => void handleSave({ publish: true })}
              disabled={!publishReady || saving}
            >
              {saving && <span className={styles.spinner} aria-hidden="true" />}
              {saving ? "Publishing…" : "Publish meal"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: TopTab; label: string }[] = [
  { id: "meal", label: "Meal" },
  { id: "promotions", label: "Promotions" },
];

export default function DishDetailPage() {
  const params = useParams<{ id: string }>();
  const dishId = params.id;

  if (!dishId) {
    return <p className={styles.loadingNote}>Dish not found.</p>;
  }

  return (
    <DishDetailProvider dishId={dishId}>
      <DishDetailContent />
    </DishDetailProvider>
  );
}

function DishDetailContent() {
  const { loading, error } = useDishDetail();
  const [tab, setTab] = useState<TopTab>("meal");

  // Only skeleton on the initial load. Quiet refreshes after save must not
  // unmount MealEditor or the combined save aborts before details + redirect.
  if (loading) {
    return <DishDetailSkeleton />;
  }

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.loadingNote}>{error}</p>
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
        {tab === "meal" && <MealEditor />}
        {tab === "promotions" && <PromotionsTab />}
      </div>
    </div>
  );
}
