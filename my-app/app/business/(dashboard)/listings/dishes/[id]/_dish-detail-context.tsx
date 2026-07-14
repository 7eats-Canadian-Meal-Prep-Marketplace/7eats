"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const ALLERGENS = [
  "Gluten",
  "Dairy",
  "Eggs",
  "Nuts",
  "Peanuts",
  "Soy",
  "Fish",
  "Shellfish",
  "Other",
] as const;

export type DishStatus = "active" | "inactive" | "draft";

export type DishPhoto = {
  id: string;
  url: string;
};

export type IngredientRow = {
  id: string;
  name: string;
};

export type NutritionForm = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  allergens: string[];
};

export type DishStats = {
  listingCount: number;
  totalOrders: number;
  avgQtyPerOrder: number;
};

type ApiIngredient = {
  id: string;
  name: string;
  isAllergen: boolean;
};

function allergensFromIngredients(ingRows: ApiIngredient[]): string[] {
  return ingRows.filter((i) => i.isAllergen).map((i) => i.name);
}

type DishDetailContextValue = {
  dishId: string;
  loading: boolean;
  error: string | null;
  stats: DishStats;
  form: {
    name: string;
    price: string;
    description: string;
    status: DishStatus;
  } | null;
  photos: DishPhoto[];
  setPhotos: React.Dispatch<React.SetStateAction<DishPhoto[]>>;
  saveDetails: (payload: {
    name: string;
    price?: string;
    description: string;
    status?: DishStatus;
  }) => Promise<boolean>;
  pauseDish: () => Promise<boolean>;
  activateDish: () => Promise<boolean>;
  deleteDish: () => Promise<boolean>;
  removePhoto: (photoId: string) => Promise<void>;
  addPhoto: (file: File) => Promise<boolean>;
  ingredients: IngredientRow[];
  setIngredients: React.Dispatch<React.SetStateAction<IngredientRow[]>>;
  nutrition: NutritionForm;
  setNutrition: React.Dispatch<React.SetStateAction<NutritionForm>>;
  saveNutrition: (payload: {
    ingredients: IngredientRow[];
    nutrition: NutritionForm;
    otherChecked: boolean;
    otherText: string;
    noneApplies: boolean;
  }) => Promise<boolean>;
  reload: (opts?: { quiet?: boolean }) => Promise<void>;
};

const DishDetailContext = createContext<DishDetailContextValue | null>(null);

export function useDishDetail() {
  const ctx = useContext(DishDetailContext);
  if (!ctx) {
    throw new Error("useDishDetail must be used within DishDetailProvider");
  }
  return ctx;
}

export function DishDetailProvider({
  dishId,
  children,
}: {
  dishId: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DishStats>({
    listingCount: 0,
    totalOrders: 0,
    avgQtyPerOrder: 0,
  });
  const [form, setForm] = useState<DishDetailContextValue["form"]>(null);
  const [photos, setPhotos] = useState<DishPhoto[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [nutrition, setNutrition] = useState<NutritionForm>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    allergens: [],
  });
  const [remoteIngredients, setRemoteIngredients] = useState<ApiIngredient[]>(
    [],
  );

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      // Quiet refresh keeps the editor mounted. A full loading=true swap would
      // unmount MealEditor mid-save and abort the details PATCH + redirect.
      if (!opts?.quiet) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/business/dishes/${dishId}`);
        if (!res.ok) {
          setError("Dish not found.");
          return;
        }
        const json = await res.json();
        const dish = json.data;
        setStats(
          dish.stats ?? {
            listingCount: 0,
            totalOrders: 0,
            avgQtyPerOrder: 0,
          },
        );
        setForm({
          name: dish.name,
          price: dish.price ?? "",
          description: dish.description ?? "",
          status: dish.status as DishStatus,
        });
        setPhotos(
          (dish.photos ?? []).map((p: { id: string; url: string }) => ({
            id: p.id,
            url: p.url,
          })),
        );
        const ingRows: ApiIngredient[] = dish.ingredients ?? [];
        setRemoteIngredients(ingRows);
        setIngredients(
          ingRows
            .filter((i) => !i.isAllergen)
            .map((i) => ({ id: i.id, name: i.name })),
        );
        setNutrition({
          calories: dish.nutrition?.calories ?? 0,
          protein: dish.nutrition?.proteinG
            ? Number(dish.nutrition.proteinG)
            : 0,
          carbs: dish.nutrition?.carbsG ? Number(dish.nutrition.carbsG) : 0,
          fat: dish.nutrition?.fatG ? Number(dish.nutrition.fatG) : 0,
          allergens: allergensFromIngredients(ingRows),
        });
      } catch {
        setError("Failed to load dish.");
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [dishId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const saveDetails = useCallback(
    async (payload: {
      name: string;
      price?: string;
      description: string;
      status?: DishStatus;
    }) => {
      const { price, status, ...rest } = payload;
      const body: Record<string, unknown> = { ...rest };
      if (price !== undefined && price !== "") {
        body.price = Number(price);
      }
      if (status !== undefined) {
        body.status = status;
      }
      const res = await fetch(`/api/business/dishes/${dishId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return false;
      await load({ quiet: true });
      return true;
    },
    [dishId, load],
  );

  const pauseDish = useCallback(async () => {
    const res = await fetch(`/api/business/dishes/${dishId}/archive`, {
      method: "POST",
    });
    if (!res.ok) return false;
    await load({ quiet: true });
    return true;
  }, [dishId, load]);

  const activateDish = useCallback(async () => {
    const res = await fetch(`/api/business/dishes/${dishId}/unarchive`, {
      method: "POST",
    });
    if (!res.ok) return false;
    await load({ quiet: true });
    return true;
  }, [dishId, load]);

  const deleteDish = useCallback(async () => {
    const res = await fetch(`/api/business/dishes/${dishId}`, {
      method: "DELETE",
    });
    return res.ok;
  }, [dishId]);

  const removePhoto = useCallback(
    async (photoId: string) => {
      await fetch(`/api/business/dishes/${dishId}/photos/${photoId}`, {
        method: "DELETE",
      });
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    },
    [dishId],
  );

  const addPhoto = useCallback(
    async (file: File) => {
      const fd = new FormData();
      fd.set("photo", file);
      fd.set("isPrimary", photos.length === 0 ? "true" : "false");
      const res = await fetch(`/api/business/dishes/${dishId}/photos/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) return false;
      const json = await res.json();
      if (json.success && json.data) {
        setPhotos((prev) => [
          ...prev,
          { id: json.data.id, url: json.data.url },
        ]);
      } else {
        await load({ quiet: true });
      }
      return true;
    },
    [dishId, load, photos.length],
  );

  const saveNutrition = useCallback(
    async (payload: {
      ingredients: IngredientRow[];
      nutrition: NutritionForm;
      otherChecked: boolean;
      otherText: string;
      noneApplies: boolean;
    }) => {
      const allergenSet = new Set(payload.nutrition.allergens);
      if (payload.otherChecked && payload.otherText.trim()) {
        allergenSet.add(payload.otherText.trim());
      }

      const remoteIds = new Set(remoteIngredients.map((i) => i.id));
      const localIds = new Set(
        payload.ingredients
          .filter((i) => !i.id.startsWith("ing-"))
          .map((i) => i.id),
      );

      for (const id of remoteIds) {
        if (!localIds.has(id)) {
          await fetch(`/api/business/dishes/${dishId}/ingredients/${id}`, {
            method: "DELETE",
          });
        }
      }

      for (const ing of payload.ingredients) {
        const isAllergen = allergenSet.has(ing.name);
        if (ing.id.startsWith("ing-")) {
          await fetch(`/api/business/dishes/${dishId}/ingredients`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: ing.name,
              isAllergen,
            }),
          });
        } else {
          await fetch(`/api/business/dishes/${dishId}/ingredients/${ing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: ing.name,
              isAllergen,
            }),
          });
        }
      }

      for (const allergen of allergenSet) {
        if (payload.ingredients.some((i) => i.name === allergen)) continue;
        const existing = remoteIngredients.find(
          (i) => i.isAllergen && i.name === allergen,
        );
        if (!existing) {
          await fetch(`/api/business/dishes/${dishId}/ingredients`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: allergen, isAllergen: true }),
          });
        }
      }

      await fetch(`/api/business/dishes/${dishId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isGlutenFree: !allergenSet.has("Gluten"),
          isDairyFree: !allergenSet.has("Dairy"),
          isNutFree: !allergenSet.has("Nuts") && !allergenSet.has("Peanuts"),
        }),
      });

      await fetch(`/api/business/dishes/${dishId}/nutrition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calories: payload.nutrition.calories || undefined,
          proteinG: payload.nutrition.protein || undefined,
          carbsG: payload.nutrition.carbs || undefined,
          fatG: payload.nutrition.fat || undefined,
        }),
      });

      await load({ quiet: true });
      return true;
    },
    [dishId, load, remoteIngredients],
  );

  const value = useMemo(
    () => ({
      dishId,
      loading,
      error,
      stats,
      form,
      photos,
      setPhotos,
      saveDetails,
      pauseDish,
      activateDish,
      deleteDish,
      removePhoto,
      addPhoto,
      ingredients,
      setIngredients,
      nutrition,
      setNutrition,
      saveNutrition,
      reload: load,
    }),
    [
      dishId,
      loading,
      error,
      stats,
      form,
      photos,
      saveDetails,
      pauseDish,
      activateDish,
      deleteDish,
      removePhoto,
      addPhoto,
      ingredients,
      nutrition,
      saveNutrition,
      load,
    ],
  );

  return (
    <DishDetailContext.Provider value={value}>
      {children}
    </DishDetailContext.Provider>
  );
}
