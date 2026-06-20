/** Client preference sheet — keys match `user_preferences` columns. */

export type ClientPreferenceKey =
  | "dietary"
  | "allergies"
  | "goals"
  | "whyMealPrep";

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
      "None",
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
  if (key === "allergies") {
    const arr = prefs.allergies;
    if (value === "None") {
      return {
        ...prefs,
        allergies: arr.includes("None") ? [] : ["None"],
      };
    }
    const withoutNone = arr.filter((v) => v !== "None");
    return {
      ...prefs,
      allergies: withoutNone.includes(value)
        ? withoutNone.filter((v) => v !== value)
        : [...withoutNone, value],
    };
  }

  const arr = prefs[key];
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
