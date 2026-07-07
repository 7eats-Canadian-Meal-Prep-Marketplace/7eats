import { describe, expect, it } from "vitest";
import {
  EMPTY_MEAL_FORM,
  EMPTY_MEAL_NUTRITION,
  isEmptyMealDraft,
  type MealDraft,
  parseMealDraft,
  step1Requirements,
  step2Requirements,
} from "@/lib/dishes/new-meal-form";

function makeDraft(overrides: Partial<MealDraft> = {}): MealDraft {
  return {
    form: EMPTY_MEAL_FORM,
    ingredients: [],
    nutrition: EMPTY_MEAL_NUTRITION,
    allergens: [],
    noneApplies: false,
    ...overrides,
  };
}

describe("parseMealDraft", () => {
  it("parses a well-formed draft", () => {
    const raw = JSON.stringify(
      makeDraft({
        form: { name: "Jollof Rice", price: "14.00", description: "Tasty" },
        ingredients: [{ id: "ing-1", name: "Rice" }],
        allergens: ["Gluten"],
      }),
    );
    const draft = parseMealDraft(raw);
    expect(draft?.form.name).toBe("Jollof Rice");
    expect(draft?.ingredients).toEqual([{ id: "ing-1", name: "Rice" }]);
    expect(draft?.allergens).toEqual(["Gluten"]);
  });

  it("fills in missing fields with empty defaults", () => {
    const draft = parseMealDraft(JSON.stringify({ form: { name: "Soup" } }));
    expect(draft?.form).toEqual({ ...EMPTY_MEAL_FORM, name: "Soup" });
    expect(draft?.ingredients).toEqual([]);
    expect(draft?.nutrition).toEqual(EMPTY_MEAL_NUTRITION);
    expect(draft?.allergens).toEqual([]);
    expect(draft?.noneApplies).toBe(false);
  });

  it("returns null for malformed JSON", () => {
    expect(parseMealDraft("{not json")).toBeNull();
  });

  it("returns null when the parsed value has no form field", () => {
    expect(parseMealDraft(JSON.stringify({ ingredients: [] }))).toBeNull();
  });
});

describe("isEmptyMealDraft", () => {
  it("is true for a draft with nothing filled in", () => {
    expect(isEmptyMealDraft(makeDraft())).toBe(true);
  });

  it("is false when the name is set", () => {
    expect(
      isEmptyMealDraft(makeDraft({ form: { ...EMPTY_MEAL_FORM, name: "X" } })),
    ).toBe(false);
  });

  it("is false when an ingredient has a name", () => {
    expect(
      isEmptyMealDraft(
        makeDraft({ ingredients: [{ id: "ing-1", name: "Salt" }] }),
      ),
    ).toBe(false);
  });

  it("is false when a nutrition field is set", () => {
    expect(
      isEmptyMealDraft(
        makeDraft({
          nutrition: { ...EMPTY_MEAL_NUTRITION, calories: "200" },
        }),
      ),
    ).toBe(false);
  });

  it("is false when noneApplies is checked", () => {
    expect(isEmptyMealDraft(makeDraft({ noneApplies: true }))).toBe(false);
  });
});

describe("step1Requirements", () => {
  it("flags every missing field", () => {
    const items = step1Requirements(EMPTY_MEAL_FORM, false);
    expect(items.every((i) => !i.met)).toBe(true);
  });

  it("is fully met with valid, complete fields and a photo", () => {
    const items = step1Requirements(
      { name: "Jollof Rice", price: "14.00", description: "Tasty" },
      true,
    );
    expect(items.every((i) => i.met)).toBe(true);
  });

  it("flags a description over the character limit as unmet", () => {
    const items = step1Requirements(
      {
        name: "Jollof Rice",
        price: "14.00",
        description: "x".repeat(501),
      },
      true,
    );
    const descriptionItem = items.find((i) => i.label.includes("Description"));
    expect(descriptionItem?.met).toBe(false);
  });
});

describe("step2Requirements", () => {
  it("requires at least one ingredient", () => {
    const items = step2Requirements([], [], false);
    expect(items[0].met).toBe(false);
  });

  it("requires every ingredient to have a name once one exists", () => {
    const items = step2Requirements(
      [{ id: "ing-1", name: "" }],
      ["Gluten"],
      false,
    );
    const nameItem = items.find(
      (i) => i.label === "Every ingredient has a name",
    );
    expect(nameItem?.met).toBe(false);
  });

  it("requires allergens selected or none-applies checked", () => {
    const withoutEither = step2Requirements(
      [{ id: "ing-1", name: "Salt" }],
      [],
      false,
    );
    expect(withoutEither.some((i) => !i.met)).toBe(true);

    const withNoneApplies = step2Requirements(
      [{ id: "ing-1", name: "Salt" }],
      [],
      true,
    );
    expect(withNoneApplies.every((i) => i.met)).toBe(true);
  });
});
