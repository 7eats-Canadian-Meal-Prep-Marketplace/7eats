import { describe, expect, it } from "vitest";
import {
  clientPreferencesEqual,
  EMPTY_CLIENT_PREFERENCES,
  normalizeClientPreferences,
} from "@/lib/client-preferences";

describe("normalizeClientPreferences", () => {
  it("returns empty arrays when preferences are missing", () => {
    expect(normalizeClientPreferences(null)).toEqual(EMPTY_CLIENT_PREFERENCES);
  });

  it("coerces stored values to string arrays", () => {
    expect(
      normalizeClientPreferences({
        dietary: ["Halal"],
        allergies: [],
        goals: ["High protein"],
        whyMealPrep: ["Save time cooking"],
      }),
    ).toEqual({
      dietary: ["Halal"],
      allergies: [],
      goals: ["High protein"],
      whyMealPrep: ["Save time cooking"],
    });
  });
});

describe("clientPreferencesEqual", () => {
  it("treats array order as irrelevant", () => {
    const a = {
      ...EMPTY_CLIENT_PREFERENCES,
      dietary: ["Halal", "Vegan"],
    };
    const b = {
      ...EMPTY_CLIENT_PREFERENCES,
      dietary: ["Vegan", "Halal"],
    };
    expect(clientPreferencesEqual(a, b)).toBe(true);
  });

  it("detects real changes", () => {
    const saved = {
      ...EMPTY_CLIENT_PREFERENCES,
      goals: ["High protein"],
    };
    const draft = {
      ...EMPTY_CLIENT_PREFERENCES,
      goals: ["Comfort food"],
    };
    expect(clientPreferencesEqual(saved, draft)).toBe(false);
  });
});
