export type MockQueueOrder = {
  id: string;
  status: "pending" | "confirmed" | "ready";
  customerName: string;
  listingTitle: string;
  quantity: number;
  totalPrice: string;
  pickupAt: string;
  notes: string | null;
};

export type MockDashboardStats = {
  earningsWeek: string;
  earningsMonth: string;
  pendingCount: number;
  activeListings: number;
  ratingAverage: number;
  ratingCount: number;
};

const base = Date.now();
const inHours = (h: number) => new Date(base + h * 3_600_000).toISOString();

export const MOCK_QUEUE: MockQueueOrder[] = [
  {
    id: "ord-1",
    status: "pending",
    customerName: "Amara Diallo",
    listingTitle: "West African Comfort Box",
    quantity: 2,
    totalPrice: "54.00",
    pickupAt: inHours(1.5),
    notes: "No pepper please",
  },
  {
    id: "ord-2",
    status: "pending",
    customerName: "Lena Schmidt",
    listingTitle: "Sunday Jollof Special",
    quantity: 1,
    totalPrice: "27.00",
    pickupAt: inHours(3),
    notes: null,
  },
  {
    id: "ord-3",
    status: "ready",
    customerName: "Marcus Osei",
    listingTitle: "West African Comfort Box",
    quantity: 3,
    totalPrice: "81.00",
    pickupAt: inHours(0.5),
    notes: null,
  },
  {
    id: "ord-4",
    status: "confirmed",
    customerName: "Priya Nair",
    listingTitle: "Kelewele Snack Pack",
    quantity: 2,
    totalPrice: "30.00",
    pickupAt: inHours(5),
    notes: null,
  },
  {
    id: "ord-5",
    status: "confirmed",
    customerName: "Tom Eriksson",
    listingTitle: "Sunday Jollof Special",
    quantity: 1,
    totalPrice: "27.00",
    pickupAt: inHours(26),
    notes: "Extra sauce if possible",
  },
];

export const MOCK_STATS: MockDashboardStats = {
  earningsWeek: "416.25",
  earningsMonth: "1,848.50",
  pendingCount: 2,
  activeListings: 3,
  ratingAverage: 4.8,
  ratingCount: 34,
};
