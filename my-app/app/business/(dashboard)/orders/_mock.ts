export type DishSnapshot = {
  name: string;
  cuisine: string;
  qty: number;
};

export type MockOrder = {
  id: string;
  status: "pending" | "confirmed" | "ready" | "fulfilled" | "cancelled";
  customerName: string;
  listingTitle: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  pickupAt: string;
  notes: string | null;
  pickupCode: string;
  dishes: DishSnapshot[];
  createdAt: string;
};

const base = Date.now();
const inHours = (h: number) => new Date(base + h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(base - d * 86_400_000).toISOString();

const WEST_AFRICAN_DISHES: DishSnapshot[] = [
  { name: "Jollof Rice", cuisine: "West African", qty: 1 },
  { name: "Fried Plantain", cuisine: "West African", qty: 1 },
  { name: "Chicken Stew", cuisine: "West African", qty: 1 },
];

const JOLLOF_DISHES: DishSnapshot[] = [
  { name: "Sunday Jollof Rice", cuisine: "West African", qty: 1 },
  { name: "Coleslaw", cuisine: "West African", qty: 1 },
];

const KELEWELE_DISHES: DishSnapshot[] = [
  { name: "Kelewele", cuisine: "Ghanaian", qty: 2 },
];

export const MOCK_ORDERS: MockOrder[] = [
  {
    id: "ord-1",
    status: "pending",
    customerName: "Amara Diallo",
    listingTitle: "West African Comfort Box",
    quantity: 2,
    unitPrice: "27.00",
    totalPrice: "54.00",
    pickupAt: inHours(1.5),
    notes: "No pepper please",
    pickupCode: "847291",
    dishes: WEST_AFRICAN_DISHES,
    createdAt: inHours(-2),
  },
  {
    id: "ord-2",
    status: "pending",
    customerName: "Lena Schmidt",
    listingTitle: "Sunday Jollof Special",
    quantity: 1,
    unitPrice: "27.00",
    totalPrice: "27.00",
    pickupAt: inHours(3),
    notes: null,
    pickupCode: "392015",
    dishes: JOLLOF_DISHES,
    createdAt: inHours(-1),
  },
  {
    id: "ord-3",
    status: "ready",
    customerName: "Marcus Osei",
    listingTitle: "West African Comfort Box",
    quantity: 3,
    unitPrice: "27.00",
    totalPrice: "81.00",
    pickupAt: inHours(0.5),
    notes: null,
    pickupCode: "614823",
    dishes: WEST_AFRICAN_DISHES,
    createdAt: inHours(-5),
  },
  {
    id: "ord-4",
    status: "confirmed",
    customerName: "Priya Nair",
    listingTitle: "Kelewele Snack Pack",
    quantity: 2,
    unitPrice: "15.00",
    totalPrice: "30.00",
    pickupAt: inHours(5),
    notes: null,
    pickupCode: "270493",
    dishes: KELEWELE_DISHES,
    createdAt: inHours(-3),
  },
  {
    id: "ord-5",
    status: "confirmed",
    customerName: "Tom Eriksson",
    listingTitle: "Sunday Jollof Special",
    quantity: 1,
    unitPrice: "27.00",
    totalPrice: "27.00",
    pickupAt: inHours(26),
    notes: "Extra sauce if possible",
    pickupCode: "538102",
    dishes: JOLLOF_DISHES,
    createdAt: inHours(-4),
  },
  {
    id: "ord-6",
    status: "fulfilled",
    customerName: "Isabelle Mouton",
    listingTitle: "Sunday Jollof Special",
    quantity: 1,
    unitPrice: "27.00",
    totalPrice: "27.00",
    pickupAt: daysAgo(1),
    notes: null,
    pickupCode: "903714",
    dishes: JOLLOF_DISHES,
    createdAt: daysAgo(2),
  },
  {
    id: "ord-7",
    status: "fulfilled",
    customerName: "Kofi Adu",
    listingTitle: "West African Comfort Box",
    quantity: 1,
    unitPrice: "27.00",
    totalPrice: "27.00",
    pickupAt: daysAgo(2),
    notes: null,
    pickupCode: "451730",
    dishes: WEST_AFRICAN_DISHES,
    createdAt: daysAgo(3),
  },
  {
    id: "ord-8",
    status: "cancelled",
    customerName: "James Watt",
    listingTitle: "Kelewele Snack Pack",
    quantity: 1,
    unitPrice: "15.00",
    totalPrice: "15.00",
    pickupAt: daysAgo(1),
    notes: null,
    pickupCode: "182647",
    dishes: KELEWELE_DISHES,
    createdAt: daysAgo(2),
  },
  {
    id: "ord-9",
    status: "pending",
    customerName: "Fatou Camara",
    listingTitle: "Kelewele Snack Pack",
    quantity: 4,
    unitPrice: "15.00",
    totalPrice: "60.00",
    pickupAt: inHours(2),
    notes: "Picking up for the whole office",
    pickupCode: "763841",
    dishes: KELEWELE_DISHES,
    createdAt: inHours(-0.5),
  },
  {
    id: "ord-10",
    status: "confirmed",
    customerName: "Nadia Okonkwo",
    listingTitle: "West African Comfort Box",
    quantity: 2,
    unitPrice: "27.00",
    totalPrice: "54.00",
    pickupAt: inHours(6),
    notes: null,
    pickupCode: "920374",
    dishes: WEST_AFRICAN_DISHES,
    createdAt: inHours(-6),
  },
  {
    id: "ord-11",
    status: "fulfilled",
    customerName: "Yaw Mensah",
    listingTitle: "Sunday Jollof Special",
    quantity: 2,
    unitPrice: "27.00",
    totalPrice: "54.00",
    pickupAt: daysAgo(3),
    notes: null,
    pickupCode: "481059",
    dishes: JOLLOF_DISHES,
    createdAt: daysAgo(4),
  },
];
