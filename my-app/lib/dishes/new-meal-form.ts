import type { IngredientRow } from "@/app/components/IngredientsInput";
import type { RequirementItem } from "@/app/components/RequirementsChecklist";
import { isValidPrice } from "@/lib/price";

export const MEAL_DESCRIPTION_MAX = 500;

export const EMPTY_MEAL_FORM = { name: "", price: "", description: "" };
export const EMPTY_MEAL_NUTRITION = {
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

export type MealFormFields = typeof EMPTY_MEAL_FORM;
export type MealNutritionFields = typeof EMPTY_MEAL_NUTRITION;

export type MealDraft = {
  form: MealFormFields;
  ingredients: IngredientRow[];
  nutrition: MealNutritionFields;
  allergens: string[];
  noneApplies: boolean;
};

/** Parses a serialized draft, tolerating missing/malformed fields. Returns null if unusable. */
export function parseMealDraft(raw: string): MealDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<MealDraft> | null;
    if (!parsed || typeof parsed !== "object" || !parsed.form) return null;
    return {
      form: { ...EMPTY_MEAL_FORM, ...parsed.form },
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      nutrition: { ...EMPTY_MEAL_NUTRITION, ...parsed.nutrition },
      allergens: Array.isArray(parsed.allergens) ? parsed.allergens : [],
      noneApplies: !!parsed.noneApplies,
    };
  } catch {
    return null;
  }
}

export function isEmptyMealDraft(d: MealDraft): boolean {
  return (
    !d.form.name.trim() &&
    !d.form.price.trim() &&
    !d.form.description.trim() &&
    d.ingredients.every((i) => !i.name.trim()) &&
    !d.nutrition.calories &&
    !d.nutrition.protein &&
    !d.nutrition.carbs &&
    !d.nutrition.fat &&
    d.allergens.length === 0 &&
    !d.noneApplies
  );
}

export function step1Requirements(
  form: MealFormFields,
  hasPhoto: boolean,
): RequirementItem[] {
  return [
    { label: "Dish name added", met: !!form.name.trim() },
    { label: "Valid price entered", met: isValidPrice(form.price) },
    {
      label:
        form.description.length > MEAL_DESCRIPTION_MAX
          ? `Description is ${MEAL_DESCRIPTION_MAX} characters or fewer`
          : "Description added",
      met:
        !!form.description.trim() &&
        form.description.length <= MEAL_DESCRIPTION_MAX,
    },
    { label: "At least 1 photo added", met: hasPhoto },
  ];
}

export function step2Requirements(
  ingredients: IngredientRow[],
  allergens: string[],
  noneApplies: boolean,
): RequirementItem[] {
  const items: RequirementItem[] = [
    { label: "At least 1 ingredient added", met: ingredients.length > 0 },
  ];
  if (ingredients.length > 0) {
    items.push({
      label: "Every ingredient has a name",
      met: ingredients.every((i) => i.name.trim().length > 0),
    });
  }
  items.push({
    label: "Allergens selected, or “None of these apply” checked",
    met: noneApplies || allergens.length > 0,
  });
  return items;
}

/** Full publish checklist (single-page create / publish draft). */
export function publishMealRequirements(
  form: MealFormFields,
  hasPhoto: boolean,
  ingredients: IngredientRow[],
  allergens: string[],
  noneApplies: boolean,
): RequirementItem[] {
  return [
    ...step1Requirements(form, hasPhoto),
    ...step2Requirements(ingredients, allergens, noneApplies),
  ];
}

/** Draft only needs a name. */
export function draftMealRequirements(form: MealFormFields): RequirementItem[] {
  return [{ label: "Dish name added", met: !!form.name.trim() }];
}
