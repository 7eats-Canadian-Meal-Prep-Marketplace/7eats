// ─── Mock data for the Listings page ────────────────────────────────────────
// Replace these with real API calls when the frontend is wired up.
// Each export maps 1:1 to a GET endpoint:
//   MOCK_LISTINGS  →  GET /api/business/listings
//   MOCK_DISHES    →  GET /api/business/listings/dishes
//   MOCK_DEALS     →  GET /api/business/listings/[id]/promotions  (flattened across all listings)

export type MockListing = {
  id: string;
  title: string;
  status: "draft" | "active" | "archived";
  basePrice: string;
  currency: string;
  dishCount: number;
  orderCount: number;
  minOrderQty: number;
  maxOrderQty: number | null;
};

export type MockDish = {
  id: string;
  name: string;
  cuisine: string | null;
  categories: string[];
  status: "draft" | "active" | "archived";
  isHalal: boolean;
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isDairyFree: boolean;
  isNutFree: boolean;
  isKosher: boolean;
  listingCount: number;
};

export type MockDeal = {
  id: string;
  type: "percentage_off" | "fixed_off" | "buy_x_get_y";
  value?: string;
  buyQty?: number;
  getQty?: number;
  listingId: string;
  listingTitle: string;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  usesCount: number;
  maxUses: number | null;
  minimumQty: number;
};

export const MOCK_LISTINGS: MockListing[] = [
  {
    id: "mock-listing-1",
    title: "Dal Makhani Family Box",
    status: "active",
    basePrice: "18.00",
    currency: "CAD",
    dishCount: 3,
    orderCount: 12,
    minOrderQty: 1,
    maxOrderQty: 10,
  },
  {
    id: "mock-listing-2",
    title: "Weekly Butter Chicken Meal Prep",
    status: "active",
    basePrice: "65.00",
    currency: "CAD",
    dishCount: 5,
    orderCount: 4,
    minOrderQty: 1,
    maxOrderQty: null,
  },
  {
    id: "mock-listing-3",
    title: "Vegan Power Bowl",
    status: "draft",
    basePrice: "14.00",
    currency: "CAD",
    dishCount: 2,
    orderCount: 0,
    minOrderQty: 1,
    maxOrderQty: 20,
  },
];

export const MOCK_DISHES: MockDish[] = [
  {
    id: "mock-dish-1",
    name: "Dal Makhani",
    cuisine: "North Indian",
    categories: ["high_protein", "comfort_food"],
    status: "active",
    isHalal: true,
    isVegan: false,
    isVegetarian: true,
    isGlutenFree: false,
    isDairyFree: false,
    isNutFree: true,
    isKosher: false,
    listingCount: 2,
  },
  {
    id: "mock-dish-2",
    name: "Butter Chicken",
    cuisine: "North Indian",
    categories: ["high_protein"],
    status: "active",
    isHalal: true,
    isVegan: false,
    isVegetarian: false,
    isGlutenFree: true,
    isDairyFree: false,
    isNutFree: false,
    isKosher: false,
    listingCount: 1,
  },
  {
    id: "mock-dish-3",
    name: "Basmati Rice Pilaf",
    cuisine: "Middle Eastern",
    categories: ["balanced"],
    status: "active",
    isHalal: true,
    isVegan: true,
    isVegetarian: true,
    isGlutenFree: true,
    isDairyFree: true,
    isNutFree: false,
    isKosher: false,
    listingCount: 2,
  },
  {
    id: "mock-dish-4",
    name: "Mango Lassi",
    cuisine: "South Asian",
    categories: ["kids_friendly"],
    status: "draft",
    isHalal: true,
    isVegan: false,
    isVegetarian: true,
    isGlutenFree: true,
    isDairyFree: false,
    isNutFree: true,
    isKosher: false,
    listingCount: 0,
  },
  {
    id: "mock-dish-5",
    name: "Chana Masala",
    cuisine: "Punjabi",
    categories: ["high_protein", "weight_loss"],
    status: "archived",
    isHalal: true,
    isVegan: true,
    isVegetarian: true,
    isGlutenFree: true,
    isDairyFree: true,
    isNutFree: true,
    isKosher: false,
    listingCount: 0,
  },
];

export const MOCK_DEALS: MockDeal[] = [
  {
    id: "mock-deal-1",
    type: "percentage_off",
    value: "15",
    listingId: "mock-listing-1",
    listingTitle: "Dal Makhani Family Box",
    isActive: true,
    validFrom: null,
    validUntil: "2026-06-30T23:59:59Z",
    usesCount: 8,
    maxUses: 50,
    minimumQty: 1,
  },
  {
    id: "mock-deal-2",
    type: "buy_x_get_y",
    buyQty: 2,
    getQty: 1,
    listingId: "mock-listing-2",
    listingTitle: "Weekly Butter Chicken Meal Prep",
    isActive: false,
    validFrom: "2026-06-01T00:00:00Z",
    validUntil: "2026-06-07T23:59:59Z",
    usesCount: 0,
    maxUses: null,
    minimumQty: 2,
  },
  {
    id: "mock-deal-3",
    type: "fixed_off",
    value: "5.00",
    listingId: "mock-listing-1",
    listingTitle: "Dal Makhani Family Box",
    isActive: true,
    validFrom: null,
    validUntil: null,
    usesCount: 23,
    maxUses: null,
    minimumQty: 3,
  },
];
