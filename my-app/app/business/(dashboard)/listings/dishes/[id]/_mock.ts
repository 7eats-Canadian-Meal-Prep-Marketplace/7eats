export const ALLERGENS = [
  "Gluten",
  "Dairy",
  "Eggs",
  "Nuts",
  "Peanuts",
  "Soy",
  "Fish",
  "Shellfish",
] as const;

export type MockDishDetail = {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  status: "active" | "draft" | "archived";
  totalOrders: number;
  listingCount: number;
  avgQtyPerOrder: number;
};

export type MockIngredient = {
  id: string;
  name: string;
  amount: string;
  unit: string;
};

export type MockNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  allergens: string[];
};

export type MockDishListing = {
  id: string;
  title: string;
  status: "active" | "draft" | "archived";
  ordersWithDish: number;
};

export const MOCK_DISH: MockDishDetail = {
  id: "dish-1",
  name: "Jollof Rice",
  cuisine: "West African",
  description:
    "Slow-cooked tomato-based rice with a smoky base, seasoned with bay leaves, thyme, and scotch bonnet. A foundational staple of West African cuisine.",
  status: "active",
  totalOrders: 48,
  listingCount: 2,
  avgQtyPerOrder: 1.3,
};

export const MOCK_INGREDIENTS: MockIngredient[] = [
  { id: "ing-1", name: "Long-grain parboiled rice", amount: "2", unit: "cups" },
  { id: "ing-2", name: "Tomato paste", amount: "3", unit: "tbsp" },
  { id: "ing-3", name: "Roma tomatoes", amount: "4", unit: "whole" },
  { id: "ing-4", name: "Scotch bonnet pepper", amount: "1", unit: "whole" },
  { id: "ing-5", name: "Chicken stock", amount: "2", unit: "cups" },
  { id: "ing-6", name: "Bay leaves", amount: "2", unit: "whole" },
  { id: "ing-7", name: "Thyme", amount: "1", unit: "tsp" },
  { id: "ing-8", name: "Onion", amount: "1", unit: "large" },
];

export const MOCK_NUTRITION: MockNutrition = {
  calories: 380,
  protein: 8,
  carbs: 74,
  fat: 6,
  allergens: [],
};

export const MOCK_DISH_LISTINGS: MockDishListing[] = [
  {
    id: "lst-1",
    title: "West African Comfort Box",
    status: "active",
    ordersWithDish: 24,
  },
  {
    id: "lst-3",
    title: "Saturday Rice Plate",
    status: "draft",
    ordersWithDish: 8,
  },
];
