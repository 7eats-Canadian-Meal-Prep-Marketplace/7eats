import { describe, expect, it } from "vitest";
import {
  CLIENT_PREFERENCE_EXCLUSIVE_OPTION,
  clientPreferencesEqual,
  clientPreferencesValidationError,
  EMPTY_CLIENT_PREFERENCES,
  isClientPreferencesComplete,
  normalizeClientPreferences,
  togglePreference,
} from "@/lib/client-preferences";

const COMPLETE_PREFS = {
  dietary: ["Halal"],
  allergies: [CLIENT_PREFERENCE_EXCLUSIVE_OPTION.allergies],
  goals: [CLIENT_PREFERENCE_EXCLUSIVE_OPTION.goals],
  whyMealPrep: ["Save time cooking"],
};

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

  it("migrates legacy allergy None to No known allergies", () => {
    expect(
      normalizeClientPreferences({
        allergies: ["None", "Peanuts"],
      }).allergies,
    ).toEqual(["No known allergies", "Peanuts"]);
  });
});

describe("isClientPreferencesComplete", () => {
  it("requires every section to have at least one selection", () => {
    expect(isClientPreferencesComplete(COMPLETE_PREFS)).toBe(true);
    expect(
      isClientPreferencesComplete({
        ...COMPLETE_PREFS,
        goals: [],
      }),
    ).toBe(false);
  });
});

describe("clientPreferencesValidationError", () => {
  it("accepts a complete valid sheet", () => {
    expect(clientPreferencesValidationError(COMPLETE_PREFS)).toBeNull();
  });

  it("rejects incomplete sheets", () => {
    expect(
      clientPreferencesValidationError({
        ...EMPTY_CLIENT_PREFERENCES,
        dietary: ["Vegan"],
      }),
    ).toBe("Pick at least one option in every section.");
  });

  it("rejects unknown option values", () => {
    expect(
      clientPreferencesValidationError({
        ...COMPLETE_PREFS,
        dietary: ["Paleo"],
      }),
    ).toBe("Invalid preference selection.");
  });
});

describe("togglePreference", () => {
  it("treats exclusive options as single-select within a section", () => {
    const withRestriction = togglePreference(
      EMPTY_CLIENT_PREFERENCES,
      "dietary",
      "Vegan",
      true,
    );
    expect(withRestriction.dietary).toEqual(["Vegan"]);

    const withExclusive = togglePreference(
      withRestriction,
      "dietary",
      CLIENT_PREFERENCE_EXCLUSIVE_OPTION.dietary,
      true,
    );
    expect(withExclusive.dietary).toEqual([
      CLIENT_PREFERENCE_EXCLUSIVE_OPTION.dietary,
    ]);

    const backToRestriction = togglePreference(
      withExclusive,
      "dietary",
      "Halal",
      true,
    );
    expect(backToRestriction.dietary).toEqual(["Halal"]);
  });

  it("clears other allergy picks when No known allergies is selected", () => {
    const withAllergies = togglePreference(
      EMPTY_CLIENT_PREFERENCES,
      "allergies",
      "Peanuts",
      true,
    );
    const withNone = togglePreference(
      { ...withAllergies, allergies: ["Peanuts", "Dairy"] },
      "allergies",
      CLIENT_PREFERENCE_EXCLUSIVE_OPTION.allergies,
      true,
    );
    expect(withNone.allergies).toEqual([
      CLIENT_PREFERENCE_EXCLUSIVE_OPTION.allergies,
    ]);
  });

  it("clears No specific goals when another goal is selected", () => {
    const withNone = togglePreference(
      EMPTY_CLIENT_PREFERENCES,
      "goals",
      CLIENT_PREFERENCE_EXCLUSIVE_OPTION.goals,
      true,
    );
    const withGoal = togglePreference(withNone, "goals", "High protein", true);
    expect(withGoal.goals).toEqual(["High protein"]);
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
