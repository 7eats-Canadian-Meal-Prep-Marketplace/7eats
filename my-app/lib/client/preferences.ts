/** Client preference sheet — keys match `user_preferences` columns. */

export type ClientPreferenceKey =
  | "dietary"
  | "allergies"
  | "goals"
  | "whyMealPrep";

/** Mutually exclusive “none / N/A” option per section (clears other picks). */
export const CLIENT_PREFERENCE_EXCLUSIVE_OPTION: Record<
  ClientPreferenceKey,
  string
> = {
  dietary: "No restrictions",
  allergies: "No known allergies",
  goals: "No specific goals",
  whyMealPrep: "Just exploring",
};

const LEGACY_ALLERGY_NONE = "None";

export type ClientPreferenceQuestion = {
  id: ClientPreferenceKey;
  question: string;
  options: readonly string[];
  multiSelect: boolean;
};

export const CLIENT_PREFERENCE_QUESTIONS: ClientPreferenceQuestion[] = [
  {
    id: "dietary",
    question: "Dietary needs",
    options: [
      "Halal",
      "Vegan",
      "Vegetarian",
      "Gluten-free",
      "Dairy-free",
      "Nut-free",
      "Kosher",
      CLIENT_PREFERENCE_EXCLUSIVE_OPTION.dietary,
    ],
    multiSelect: true,
  },
  {
    id: "allergies",
    question: "Allergies",
    options: [
      "Tree nuts",
      "Peanuts",
      "Dairy",
      "Gluten",
      "Shellfish",
      "Eggs",
      "Soy",
      CLIENT_PREFERENCE_EXCLUSIVE_OPTION.allergies,
    ],
    multiSelect: true,
  },
  {
    id: "goals",
    question: "Goals & preferences",
    options: [
      "High protein",
      "Weight loss",
      "Low carb",
      "Muscle gain",
      "Heart health",
      "Comfort food",
      "Family-friendly",
      "Balanced",
      CLIENT_PREFERENCE_EXCLUSIVE_OPTION.goals,
    ],
    multiSelect: true,
  },
  {
    id: "whyMealPrep",
    question: "Why do you order meal prep?",
    options: [
      "Save time cooking",
      "Eat healthier",
      "Budget-friendly eating",
      "Discover new cuisines",
      "Support local home cooks",
      "Convenient for my schedule",
      CLIENT_PREFERENCE_EXCLUSIVE_OPTION.whyMealPrep,
    ],
    multiSelect: true,
  },
];

export type ClientPreferences = Record<ClientPreferenceKey, string[]>;

export const EMPTY_CLIENT_PREFERENCES: ClientPreferences = {
  dietary: [],
  allergies: [],
  goals: [],
  whyMealPrep: [],
};

const PREFERENCE_KEYS: ClientPreferenceKey[] = [
  "dietary",
  "allergies",
  "goals",
  "whyMealPrep",
];

function migrateLegacyAllergyValue(value: string): string {
  return value === LEGACY_ALLERGY_NONE
    ? CLIENT_PREFERENCE_EXCLUSIVE_OPTION.allergies
    : value;
}

export function normalizeClientPreferences(
  raw: Partial<ClientPreferences> | null | undefined,
): ClientPreferences {
  return {
    dietary: Array.isArray(raw?.dietary) ? raw.dietary.map(String) : [],
    allergies: Array.isArray(raw?.allergies)
      ? raw.allergies.map(String).map(migrateLegacyAllergyValue)
      : [],
    goals: Array.isArray(raw?.goals) ? raw.goals.map(String) : [],
    whyMealPrep: Array.isArray(raw?.whyMealPrep)
      ? raw.whyMealPrep.map(String)
      : [],
  };
}

export function isClientPreferencesComplete(prefs: ClientPreferences): boolean {
  return PREFERENCE_KEYS.every((key) => prefs[key].length > 0);
}

export function clientPreferencesValidationError(
  prefs: ClientPreferences,
): string | null {
  if (!isClientPreferencesComplete(prefs)) {
    return "Pick at least one option in every section.";
  }

  for (const question of CLIENT_PREFERENCE_QUESTIONS) {
    for (const value of prefs[question.id]) {
      if (!question.options.includes(value)) {
        return "Invalid preference selection.";
      }
    }
  }

  return null;
}

function sortedValues(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function clientPreferencesEqual(
  a: ClientPreferences,
  b: ClientPreferences,
): boolean {
  return PREFERENCE_KEYS.every((key) => {
    const left = sortedValues(a[key]);
    const right = sortedValues(b[key]);
    return (
      left.length === right.length &&
      left.every((value, i) => value === right[i])
    );
  });
}

const ONBOARDING_STORAGE_KEY = "onboarding";

export type OnboardingStorage = {
  step: 2;
  phone: string;
  dob: string;
};

export function readOnboardingStorage(): OnboardingStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingStorage>;
    if (parsed.step !== 2 || !parsed.dob) return null;
    return {
      step: 2,
      phone: parsed.phone ?? "",
      dob: parsed.dob,
    };
  } catch {
    return null;
  }
}

export function writeOnboardingStorage(data: OnboardingStorage): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data));
}

export function clearOnboardingStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

export function togglePreference(
  prefs: ClientPreferences,
  key: ClientPreferenceKey,
  value: string,
  multiSelect: boolean,
): ClientPreferences {
  const exclusive = CLIENT_PREFERENCE_EXCLUSIVE_OPTION[key];
  const arr = prefs[key];

  if (multiSelect && exclusive) {
    if (value === exclusive) {
      return {
        ...prefs,
        [key]: arr.includes(exclusive) ? [] : [exclusive],
      };
    }

    const withoutExclusive = arr.filter((v) => v !== exclusive);
    return {
      ...prefs,
      [key]: withoutExclusive.includes(value)
        ? withoutExclusive.filter((v) => v !== value)
        : [...withoutExclusive, value],
    };
  }

  if (multiSelect) {
    return {
      ...prefs,
      [key]: arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value],
    };
  }

  return { ...prefs, [key]: [value] };
}
