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

export type DishStatus = "active" | "draft" | "archived";

export type DishPhoto = {
  id: string;
  url: string;
};

export type IngredientRow = {
  id: string;
  name: string;
  amount: string;
  unit: string;
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
  quantity: string | null;
  isAllergen: boolean;
};

function parseQuantity(qty: string | null): { amount: string; unit: string } {
  if (!qty) return { amount: "", unit: "" };
  const parts = qty.trim().split(/\s+/);
  if (parts.length === 1) return { amount: parts[0], unit: "" };
  return { amount: parts[0], unit: parts.slice(1).join(" ") };
}

function formatQuantity(amount: string, unit: string): string | undefined {
  const combined = [amount.trim(), unit.trim()].filter(Boolean).join(" ");
  return combined || undefined;
}

function allergensFromDish(dish: {
  isGlutenFree: boolean;
  isDairyFree: boolean;
  isNutFree: boolean;
}): string[] {
  const out: string[] = [];
  if (!dish.isGlutenFree) out.push("Gluten");
  if (!dish.isDairyFree) out.push("Dairy");
  if (!dish.isNutFree) out.push("Nuts");
  return out;
}

type DishDetailContextValue = {
  dishId: string;
  loading: boolean;
  error: string | null;
  stats: DishStats;
  form: {
    name: string;
    price: string;
    cuisine: string;
    description: string;
    status: DishStatus;
  } | null;
  photos: DishPhoto[];
  setPhotos: React.Dispatch<React.SetStateAction<DishPhoto[]>>;
  saveDetails: (payload: {
    name: string;
    price?: string;
    cuisine: string;
    description: string;
  }) => Promise<boolean>;
  archiveDish: () => Promise<boolean>;
  removePhoto: (photoId: string) => Promise<void>;
  ingredients: IngredientRow[];
  setIngredients: React.Dispatch<React.SetStateAction<IngredientRow[]>>;
  nutrition: NutritionForm;
  setNutrition: React.Dispatch<React.SetStateAction<NutritionForm>>;
  saveNutrition: (payload: {
    ingredients: IngredientRow[];
    nutrition: NutritionForm;
    otherChecked: boolean;
    otherText: string;
  }) => Promise<boolean>;
  reload: () => Promise<void>;
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

  const load = useCallback(async () => {
    setLoading(true);
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
        cuisine: dish.cuisine ?? "",
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
        ingRows.map((i) => {
          const { amount, unit } = parseQuantity(i.quantity);
          return { id: i.id, name: i.name, amount, unit };
        }),
      );
      setNutrition({
        calories: dish.nutrition?.calories ?? 0,
        protein: dish.nutrition?.proteinG ? Number(dish.nutrition.proteinG) : 0,
        carbs: dish.nutrition?.carbsG ? Number(dish.nutrition.carbsG) : 0,
        fat: dish.nutrition?.fatG ? Number(dish.nutrition.fatG) : 0,
        allergens: allergensFromDish(dish),
      });
    } catch {
      setError("Failed to load dish.");
    } finally {
      setLoading(false);
    }
  }, [dishId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDetails = useCallback(
    async (payload: {
      name: string;
      price?: string;
      cuisine: string;
      description: string;
    }) => {
      const { price, ...rest } = payload;
      const body =
        price !== undefined && price !== ""
          ? { ...rest, price: Number(price) }
          : rest;
      const res = await fetch(`/api/business/dishes/${dishId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return false;
      await load();
      return true;
    },
    [dishId, load],
  );

  const archiveDish = useCallback(async () => {
    const res = await fetch(`/api/business/dishes/${dishId}/archive`, {
      method: "POST",
    });
    if (!res.ok) return false;
    await load();
    return true;
  }, [dishId, load]);

  const removePhoto = useCallback(
    async (photoId: string) => {
      await fetch(`/api/business/dishes/${dishId}/photos/${photoId}`, {
        method: "DELETE",
      });
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    },
    [dishId],
  );

  const saveNutrition = useCallback(
    async (payload: {
      ingredients: IngredientRow[];
      nutrition: NutritionForm;
      otherChecked: boolean;
      otherText: string;
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
        const quantity = formatQuantity(ing.amount, ing.unit);
        const isAllergen = allergenSet.has(ing.name);
        if (ing.id.startsWith("ing-")) {
          await fetch(`/api/business/dishes/${dishId}/ingredients`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: ing.name,
              quantity,
              isAllergen,
            }),
          });
        } else {
          await fetch(`/api/business/dishes/${dishId}/ingredients/${ing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: ing.name,
              quantity,
              isAllergen,
            }),
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

      await load();
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
      archiveDish,
      removePhoto,
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
      archiveDish,
      removePhoto,
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
