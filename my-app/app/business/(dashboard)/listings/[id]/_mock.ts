export type MockPricingTier = {
  id: string;
  minQty: number;
  pricePerUnit: string;
};

export const MOCK_PRICING_TIERS: MockPricingTier[] = [
  { id: "tier-1", minQty: 5, pricePerUnit: "25.00" },
  { id: "tier-2", minQty: 10, pricePerUnit: "22.00" },
];

export type MockListingDetail = {
  id: string;
  title: string;
  description: string;
  basePrice: string;
  currency: string;
  minOrderQty: number;
  maxOrderQty: number | null;
  status: "active" | "draft" | "archived";
  totalOrders: number;
  totalRevenue: string;
  avgOrderValue: string;
};

export type MockListingDish = {
  id: string;
  name: string;
  cuisine: string;
  qty: number;
  hasActiveOrders: boolean;
};

export type MockDealType = "percentage_off" | "fixed_off" | "bogo";

export type MockListingDeal = {
  id: string;
  type: MockDealType;
  value: number;
  buyQty: number | null;
  getQty: number | null;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  usesCount: number;
};

export type MockListingOrder = {
  id: string;
  status: "pending" | "confirmed" | "ready" | "fulfilled" | "cancelled";
  customerName: string;
  quantity: number;
  totalPrice: string;
  pickupAt: string;
};

export type MockAvailableDish = {
  id: string;
  name: string;
  cuisine: string;
};

export const MOCK_LISTING: MockListingDetail = {
  id: "lst-1",
  title: "West African Comfort Box",
  description:
    "A hearty selection of classic West African staples — jollof rice, fried plantain, and a slow-cooked chicken stew. Perfect for sharing or a satisfying solo meal.",
  basePrice: "27.00",
  currency: "CAD",
  minOrderQty: 1,
  maxOrderQty: 6,
  status: "active",
  totalOrders: 24,
  totalRevenue: "648.00",
  avgOrderValue: "27.00",
};

export const MOCK_LISTING_DISHES: MockListingDish[] = [
  {
    id: "dish-1",
    name: "Jollof Rice",
    cuisine: "West African",
    qty: 1,
    hasActiveOrders: true,
  },
  {
    id: "dish-2",
    name: "Fried Plantain",
    cuisine: "West African",
    qty: 1,
    hasActiveOrders: true,
  },
  {
    id: "dish-3",
    name: "Chicken Stew",
    cuisine: "West African",
    qty: 1,
    hasActiveOrders: true,
  },
];

export const MOCK_LISTING_DEALS: MockListingDeal[] = [
  {
    id: "deal-1",
    type: "percentage_off",
    value: 10,
    buyQty: null,
    getQty: null,
    isActive: true,
    validFrom: null,
    validUntil: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    maxUses: 50,
    usesCount: 12,
  },
  {
    id: "deal-2",
    type: "fixed_off",
    value: 5,
    buyQty: null,
    getQty: null,
    isActive: false,
    validFrom: null,
    validUntil: null,
    maxUses: null,
    usesCount: 3,
  },
];

const base = Date.now();
const inHours = (h: number) => new Date(base + h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(base - d * 86_400_000).toISOString();

export const MOCK_LISTING_ORDERS: MockListingOrder[] = [
  {
    id: "ord-1",
    status: "pending",
    customerName: "Amara Diallo",
    quantity: 2,
    totalPrice: "54.00",
    pickupAt: inHours(1.5),
  },
  {
    id: "ord-3",
    status: "ready",
    customerName: "Marcus Osei",
    quantity: 3,
    totalPrice: "81.00",
    pickupAt: inHours(0.5),
  },
  {
    id: "ord-7",
    status: "fulfilled",
    customerName: "Kofi Adu",
    quantity: 1,
    totalPrice: "27.00",
    pickupAt: daysAgo(2),
  },
  {
    id: "ord-9",
    status: "fulfilled",
    customerName: "Sophie Bernard",
    quantity: 2,
    totalPrice: "54.00",
    pickupAt: daysAgo(5),
  },
  {
    id: "ord-10",
    status: "cancelled",
    customerName: "Alex Kim",
    quantity: 1,
    totalPrice: "27.00",
    pickupAt: daysAgo(3),
  },
];

export const MOCK_AVAILABLE_DISHES: MockAvailableDish[] = [
  { id: "dish-4", name: "Kelewele", cuisine: "Ghanaian" },
  { id: "dish-5", name: "Egusi Soup", cuisine: "Nigerian" },
  { id: "dish-6", name: "Coleslaw", cuisine: "West African" },
];

export type MockListingReview = {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
};

export const MOCK_LISTING_REVIEWS: MockListingReview[] = [
  {
    id: "rev-1",
    customerName: "Amara Diallo",
    rating: 5,
    comment:
      "Absolutely incredible. The jollof rice was perfectly smoky and the chicken stew was rich and comforting. Will order again without question.",
    date: daysAgo(2),
  },
  {
    id: "rev-2",
    customerName: "Sophie Bernard",
    rating: 5,
    comment:
      "Best West African food I've had outside of home cooking. The plantain was perfectly ripe. Highly recommended.",
    date: daysAgo(5),
  },
  {
    id: "rev-3",
    customerName: "Marcus Osei",
    rating: 4,
    comment:
      "Great flavours and generous portions. Pickup was seamless. Docking one star only because the stew could have been a touch hotter on arrival.",
    date: daysAgo(8),
  },
  {
    id: "rev-4",
    customerName: "Kofi Adu",
    rating: 5,
    comment:
      "The jollof rice is genuinely top tier. Reminded me of my grandmother's cooking. Thank you for this.",
    date: daysAgo(12),
  },
  {
    id: "rev-5",
    customerName: "Priya Nair",
    rating: 3,
    comment:
      "Good food overall but the portion felt a little smaller than expected for the price. Flavours were on point though.",
    date: daysAgo(18),
  },
];
