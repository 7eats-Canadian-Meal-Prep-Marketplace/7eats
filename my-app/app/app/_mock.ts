// Helper — deadlines relative to module load time so urgency demo always works
const _now = Date.now();
const _hrs = (h: number) => new Date(_now + h * 3_600_000).toISOString();

export type NicheCategory =
  | "high_protein"
  | "low_carb"
  | "muscle_gain"
  | "heart_health"
  | "weight_loss"
  | "balanced"
  | "comfort_food"
  | "kids_friendly";

export type DietaryBadge =
  | "halal"
  | "vegan"
  | "vegetarian"
  | "gluten-free"
  | "dairy-free"
  | "nut-free"
  | "kosher";

export type CuisineType =
  | "West African"
  | "Korean"
  | "Brazilian"
  | "Middle Eastern"
  | "Italian"
  | "Caribbean"
  | "Japanese"
  | "South Asian";

export type MockCook = {
  id: string;
  displayName: string;
  bio: string;
  cuisineTypes: CuisineType[];
  initials: string;
  gradient: string;
  rating: number;
  reviewCount: number;
  neighborhood: string;
  city: string;
  badges: DietaryBadge[];
  leadTime: string;
  verified: boolean;
  emoji: string;
  listingIds: string[];
};

export type MockDish = {
  id: string;
  name: string;
  description: string;
  price: number;
  portionSize: string;
  emoji: string;
  badges: DietaryBadge[];
};

export type MockListing = {
  id: string;
  cookId: string;
  title: string;
  description: string;
  gradient: string;
  image: string;
  emoji: string;
  pickupDate: string;
  pickupDateFull: string;
  pickupWindow: string;
  orderDeadline: string;
  orderDeadlineShort: string;
  orderDeadlineIso: string;
  maxOrders: number;
  ordersLeft: number;
  dishes: MockDish[];
  cuisineTypes: CuisineType[];
  priceFrom: number;
  orderType: "one-time" | "subscription" | "both";
  fulfillment: "pickup" | "delivery" | "both";
  deal: { badge: string; label: string } | null;
  distanceKm: number;
  isNew: boolean;
  isSpotlight: boolean;
  isHighProtein: boolean;
  niches: NicheCategory[];
};

export type CartItem = {
  dishId: string;
  dishName: string;
  dishEmoji: string;
  listingId: string;
  listingTitle: string;
  cookId: string;
  cookName: string;
  cookInitials: string;
  cookGradient: string;
  price: number;
  quantity: number;
};

export type OrderStatus = "confirmed" | "ready" | "completed" | "cancelled";

export type MockOrder = {
  id: string;
  cookId: string;
  cookName: string;
  cookInitials: string;
  listingTitle: string;
  listingGradient: string;
  listingEmoji: string;
  pickupDate: string;
  pickupWindow: string;
  dishes: { name: string; quantity: number; price: number }[];
  subtotal: number;
  serviceFee: number;
  total: number;
  status: OrderStatus;
  pickupCode: string;
  pickupAddress: string;
};

export type MockMessageThread = {
  id: string;
  cookId: string;
  cookName: string;
  cookInitials: string;
  cookGradient: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  messages: {
    id: string;
    from: "client" | "cook";
    text: string;
    timestamp: string;
  }[];
};

export type PreferenceQuestion = {
  id: string;
  question: string;
  options: string[];
  multiSelect: boolean;
};

// ─── Cooks ────────────────────────────────────────────────────────────────────

/** Grayscale avatar backgrounds — profile circles only, not listing imagery */
export const COOK_AVATAR_GRADIENTS: Record<string, string> = {
  "cook-1": "linear-gradient(135deg, #6b6b6b 0%, #3a3a3a 100%)",
  "cook-2": "linear-gradient(135deg, #757575 0%, #454545 100%)",
  "cook-3": "linear-gradient(135deg, #828282 0%, #505050 100%)",
  "cook-4": "linear-gradient(135deg, #585858 0%, #2e2e2e 100%)",
  "cook-5": "linear-gradient(135deg, #707070 0%, #424242 100%)",
  "cook-6": "linear-gradient(135deg, #6a6a6a 0%, #383838 100%)",
  "cook-7": "linear-gradient(135deg, #797979 0%, #484848 100%)",
  "cook-8": "linear-gradient(135deg, #676767 0%, #3c3c3c 100%)",
};

export const MOCK_COOKS: MockCook[] = [
  {
    id: "cook-1",
    displayName: "Amara Diallo",
    bio: "Bringing the rich, bold flavours of West Africa to Toronto — one home-cooked meal at a time. Every dish is made with love, fresh ingredients, and my grandmother's secret recipes.",
    cuisineTypes: ["West African"],
    initials: "AD",
    gradient: COOK_AVATAR_GRADIENTS["cook-1"],
    rating: 4.9,
    reviewCount: 47,
    neighborhood: "Roncesvalles",
    city: "Toronto",
    badges: ["halal"],
    leadTime: "Order 48h in advance",
    verified: true,
    emoji: "🥘",
    listingIds: ["listing-1", "listing-6", "listing-17", "listing-21"],
  },
  {
    id: "cook-2",
    displayName: "Ji-won Park",
    bio: "Korean home cooking made with the freshest ingredients. I make the banchan my halmeoni taught me — kimchi, japchae, galbi, and more. Everything is made to order, no shortcuts.",
    cuisineTypes: ["Korean"],
    initials: "JP",
    gradient: COOK_AVATAR_GRADIENTS["cook-2"],
    rating: 4.8,
    reviewCount: 31,
    neighborhood: "Christie Pits",
    city: "Toronto",
    badges: ["gluten-free"],
    leadTime: "Order 24h in advance",
    verified: true,
    emoji: "🍲",
    listingIds: ["listing-2", "listing-7", "listing-20", "listing-24"],
  },
  {
    id: "cook-3",
    displayName: "Maria Santos",
    bio: "From São Paulo to your table. Feijoada, coxinha, brigadeiros — every bite is a trip home. I cook in large batches every Friday and Saturday for weekend pickup.",
    cuisineTypes: ["Brazilian"],
    initials: "MS",
    gradient: COOK_AVATAR_GRADIENTS["cook-3"],
    rating: 4.7,
    reviewCount: 22,
    neighborhood: "Kensington Market",
    city: "Toronto",
    badges: ["dairy-free"],
    leadTime: "Order 48h in advance",
    verified: false,
    emoji: "🍖",
    listingIds: ["listing-4", "listing-16", "listing-28"],
  },
  {
    id: "cook-4",
    displayName: "Fatima Al-Hassan",
    bio: "Levantine home cooking: shawarma plates, fattoush, musakhan, and the best hummus you'll have outside of Ramallah. Halal certified, always fresh, never frozen.",
    cuisineTypes: ["Middle Eastern"],
    initials: "FA",
    gradient: COOK_AVATAR_GRADIENTS["cook-4"],
    rating: 5.0,
    reviewCount: 18,
    neighborhood: "Scarborough",
    city: "Toronto",
    badges: ["halal", "dairy-free"],
    leadTime: "Order 72h in advance",
    verified: true,
    emoji: "🧆",
    listingIds: [
      "listing-3",
      "listing-8",
      "listing-18",
      "listing-22",
      "listing-23",
    ],
  },
  {
    id: "cook-5",
    displayName: "Nadia Romano",
    bio: "Northern Italian classics — risotto, osso buco, handmade pasta, and tiramisu. My nonna would approve. Sunday meal prep that actually transports you to Lombardy.",
    cuisineTypes: ["Italian"],
    initials: "NR",
    gradient: COOK_AVATAR_GRADIENTS["cook-5"],
    rating: 4.6,
    reviewCount: 14,
    neighborhood: "Little Italy",
    city: "Toronto",
    badges: [],
    leadTime: "Order 48h in advance",
    verified: false,
    emoji: "🍝",
    listingIds: ["listing-5", "listing-15", "listing-27"],
  },
  {
    id: "cook-6",
    displayName: "Priya Sharma",
    bio: "South Asian home cooking rooted in my mother's kitchen in Pune. From slow-cooked dals and spiced biryanis to fresh chutneys and rotis. Pure comfort in every box.",
    cuisineTypes: ["South Asian"],
    initials: "PS",
    gradient: COOK_AVATAR_GRADIENTS["cook-6"],
    rating: 4.8,
    reviewCount: 19,
    neighborhood: "Mississauga",
    city: "Toronto",
    badges: ["vegetarian"],
    leadTime: "Order 48h in advance",
    verified: true,
    emoji: "🍛",
    listingIds: ["listing-9", "listing-10", "listing-19", "listing-25"],
  },
  {
    id: "cook-7",
    displayName: "Takeshi Yamamoto",
    bio: "Osaka-born, Toronto-based. I make real tonkotsu ramen broth (18-hour simmer), bento boxes, and onigiri. Comfort food that takes time — yours doesn't have to.",
    cuisineTypes: ["Japanese"],
    initials: "TY",
    gradient: COOK_AVATAR_GRADIENTS["cook-7"],
    rating: 4.7,
    reviewCount: 9,
    neighborhood: "Bloor West Village",
    city: "Toronto",
    badges: [],
    leadTime: "Order 24h in advance",
    verified: false,
    emoji: "🍜",
    listingIds: ["listing-11", "listing-12", "listing-26"],
  },
  {
    id: "cook-8",
    displayName: "Yolanda Dubois",
    bio: "Trinidadian roots, Toronto kitchen. Jerk everything, curry goat, doubles, and rum cake. My food hits different — ask anyone who's tried it.",
    cuisineTypes: ["Caribbean"],
    initials: "YD",
    gradient: COOK_AVATAR_GRADIENTS["cook-8"],
    rating: 4.9,
    reviewCount: 27,
    neighborhood: "Brampton",
    city: "Toronto",
    badges: [],
    leadTime: "Order 72h in advance",
    verified: true,
    emoji: "🌶️",
    listingIds: ["listing-13", "listing-14", "listing-29"],
  },
];

// ─── Listings ─────────────────────────────────────────────────────────────────

export const MOCK_LISTINGS: MockListing[] = [
  // ── listing-1 ──────────────────────────────────────────────────────────────
  {
    id: "listing-1",
    cookId: "cook-1",
    title: "West African Weekend Feast",
    description:
      "Choose from Jollof Rice, Egusi Stew, and Suya Skewers. Everything made fresh Friday morning for Saturday and Sunday pickup.",
    gradient: "linear-gradient(135deg, #c0392b 0%, #8e1a10 100%)",
    image: "/placeholder.jpg",
    emoji: "🥘",
    pickupDate: "Sat Jun 6",
    pickupDateFull: "Saturday, June 6th",
    pickupWindow: "12pm – 5pm",
    orderDeadline: "Thu Jun 4, 11:59pm",
    orderDeadlineShort: "Thu Jun 4",
    orderDeadlineIso: _hrs(71),
    maxOrders: 12,
    ordersLeft: 3,
    cuisineTypes: ["West African"],
    priceFrom: 18,
    orderType: "both",
    fulfillment: "pickup",
    deal: null,
    distanceKm: 1.2,
    isNew: false,
    isSpotlight: true,
    isHighProtein: true,
    niches: ["high_protein", "comfort_food"],
    dishes: [
      {
        id: "dish-1-1",
        name: "Jollof Rice (Party Style)",
        description: "Smoky, tomato-based rice with a signature crust.",
        price: 18,
        portionSize: "Serves 2",
        emoji: "🍛",
        badges: ["halal", "gluten-free"],
      },
      {
        id: "dish-1-2",
        name: "Egusi Stew + Fufu",
        description: "Ground melon seed stew with pounded yam.",
        price: 22,
        portionSize: "Serves 1–2",
        emoji: "🥘",
        badges: ["halal", "gluten-free"],
      },
      {
        id: "dish-1-3",
        name: "Suya Skewers (6 pcs)",
        description: "Spiced grilled beef skewers with yaji powder.",
        price: 20,
        portionSize: "6 skewers",
        emoji: "🍢",
        badges: ["halal", "gluten-free"],
      },
    ],
  },
  // ── listing-2 ──────────────────────────────────────────────────────────────
  {
    id: "listing-2",
    cookId: "cook-2",
    title: "Korean Banchan Box",
    description:
      "A curated set of house-made banchan: kimchi, spinach namul, japchae, and more. Perfect for 2–3 days of incredible side dishes.",
    gradient: "linear-gradient(135deg, #bf2026 0%, #6e0a0e 100%)",
    image: "/placeholder.jpg",
    emoji: "🍱",
    pickupDate: "Fri Jun 5",
    pickupDateFull: "Friday, June 5th",
    pickupWindow: "5pm – 8pm",
    orderDeadline: "Wed Jun 3, 11:59pm",
    orderDeadlineShort: "Wed Jun 3",
    orderDeadlineIso: _hrs(47),
    maxOrders: 15,
    ordersLeft: 8,
    cuisineTypes: ["Korean"],
    priceFrom: 16,
    orderType: "subscription",
    fulfillment: "both",
    deal: null,
    distanceKm: 2.4,
    isNew: false,
    isSpotlight: true,
    isHighProtein: false,
    niches: ["comfort_food", "balanced"],
    dishes: [
      {
        id: "dish-2-1",
        name: "Banchan Box (5 sides)",
        description: "Kimchi, spinach namul, kongnamul, japchae, gyeran-mari.",
        price: 24,
        portionSize: "~1L total",
        emoji: "🍱",
        badges: ["gluten-free"],
      },
      {
        id: "dish-2-2",
        name: "Galbi (Short Ribs)",
        description: "Marinated beef short ribs in soy-sesame sauce.",
        price: 32,
        portionSize: "Serves 2",
        emoji: "🥩",
        badges: [],
      },
      {
        id: "dish-2-3",
        name: "Doenjang Jjigae",
        description: "Fermented soybean paste stew with tofu and mushrooms.",
        price: 16,
        portionSize: "Serves 2",
        emoji: "🫕",
        badges: ["vegetarian", "gluten-free"],
      },
    ],
  },
  // ── listing-3 ──────────────────────────────────────────────────────────────
  {
    id: "listing-3",
    cookId: "cook-4",
    title: "Levantine Mezze Spread",
    description:
      "A full mezze experience: hummus, baba ganoush, fattoush, grape leaves, and your choice of protein. Halal certified.",
    gradient: "linear-gradient(135deg, #b8712a 0%, #7a4510 100%)",
    image: "/placeholder.jpg",
    emoji: "🧆",
    pickupDate: "Sun Jun 7",
    pickupDateFull: "Sunday, June 7th",
    pickupWindow: "1pm – 4pm",
    orderDeadline: "Thu Jun 4, 8pm",
    orderDeadlineShort: "Thu Jun 4",
    orderDeadlineIso: _hrs(68),
    maxOrders: 10,
    ordersLeft: 10,
    cuisineTypes: ["Middle Eastern"],
    priceFrom: 14,
    orderType: "one-time",
    fulfillment: "pickup",
    deal: null,
    distanceKm: 5.8,
    isNew: false,
    isSpotlight: false,
    isHighProtein: false,
    niches: ["balanced", "heart_health"],
    dishes: [
      {
        id: "dish-3-1",
        name: "Mezze Platter",
        description: "Hummus, baba ganoush, tabbouleh, and 4 warm pita breads.",
        price: 16,
        portionSize: "Serves 2",
        emoji: "🫙",
        badges: ["halal", "vegetarian"],
      },
      {
        id: "dish-3-2",
        name: "Chicken Musakhan",
        description:
          "Sumac-spiced chicken on taboon bread with caramelized onions.",
        price: 26,
        portionSize: "Serves 2",
        emoji: "🍗",
        badges: ["halal", "dairy-free"],
      },
      {
        id: "dish-3-3",
        name: "Stuffed Grape Leaves (12 pcs)",
        description: "Rice and herb stuffed grape leaves with lemon sauce.",
        price: 14,
        portionSize: "12 pieces",
        emoji: "🥬",
        badges: ["halal", "vegan", "gluten-free"],
      },
    ],
  },
  // ── listing-4 ──────────────────────────────────────────────────────────────
  {
    id: "listing-4",
    cookId: "cook-3",
    title: "Brazilian Saturday",
    description:
      "Authentic feijoada and sides, coxinha for snacking, and brigadeiros for dessert. A full taste of São Paulo.",
    gradient: "linear-gradient(135deg, #1a7a4a 0%, #0d4a2a 100%)",
    image: "/placeholder.jpg",
    emoji: "🍖",
    pickupDate: "Sat Jun 6",
    pickupDateFull: "Saturday, June 6th",
    pickupWindow: "11am – 3pm",
    orderDeadline: "Wed Jun 3, 11:59pm",
    orderDeadlineShort: "Wed Jun 3",
    orderDeadlineIso: _hrs(47),
    maxOrders: 8,
    ordersLeft: 5,
    cuisineTypes: ["Brazilian"],
    priceFrom: 14,
    orderType: "both",
    fulfillment: "pickup",
    deal: {
      badge: "Buy 1 Get 1 Free",
      label: "Buy one main, get a second free",
    },
    distanceKm: 0.8,
    isNew: false,
    isSpotlight: false,
    isHighProtein: false,
    niches: ["comfort_food"],
    dishes: [
      {
        id: "dish-4-1",
        name: "Feijoada",
        description: "Black bean stew with pork and beef, rice and farofa.",
        price: 26,
        portionSize: "Serves 2",
        emoji: "🫘",
        badges: ["dairy-free", "gluten-free"],
      },
      {
        id: "dish-4-2",
        name: "Coxinha (6 pcs)",
        description: "Crispy chicken-filled dough balls.",
        price: 20,
        portionSize: "6 pieces",
        emoji: "🍗",
        badges: ["dairy-free"],
      },
      {
        id: "dish-4-3",
        name: "Brigadeiros (dozen)",
        description: "Classic Brazilian chocolate truffles.",
        price: 14,
        portionSize: "12 pieces",
        emoji: "🍫",
        badges: ["vegetarian"],
      },
    ],
  },
  // ── listing-5 ──────────────────────────────────────────────────────────────
  {
    id: "listing-5",
    cookId: "cook-5",
    title: "Sunday Italian Meal Prep",
    description:
      "Northern Italian comfort food: handmade pasta, slow-cooked ragù, and tiramisu. Family recipes from Lombardy.",
    gradient: "linear-gradient(135deg, #9a4a28 0%, #5c2a0a 100%)",
    image: "/placeholder.jpg",
    emoji: "🍝",
    pickupDate: "Sun Jun 7",
    pickupDateFull: "Sunday, June 7th",
    pickupWindow: "2pm – 6pm",
    orderDeadline: "Fri Jun 5, 11:59pm",
    orderDeadlineShort: "Fri Jun 5",
    orderDeadlineIso: _hrs(95),
    maxOrders: 10,
    ordersLeft: 7,
    cuisineTypes: ["Italian"],
    priceFrom: 16,
    orderType: "subscription",
    fulfillment: "delivery",
    deal: null,
    distanceKm: 3.1,
    isNew: false,
    isSpotlight: false,
    isHighProtein: false,
    niches: ["comfort_food"],
    dishes: [
      {
        id: "dish-5-1",
        name: "Handmade Tagliatelle + Ragù",
        description: "Fresh egg pasta with a 6-hour slow-cooked meat sauce.",
        price: 28,
        portionSize: "Serves 2",
        emoji: "🍝",
        badges: [],
      },
      {
        id: "dish-5-2",
        name: "Risotto Milanese",
        description: "Saffron-scented risotto with Parmigiano Reggiano.",
        price: 22,
        portionSize: "Serves 2",
        emoji: "🍚",
        badges: ["vegetarian"],
      },
      {
        id: "dish-5-3",
        name: "Tiramisu (2 portions)",
        description: "Classic tiramisu with savoiardi and espresso.",
        price: 16,
        portionSize: "2 portions",
        emoji: "🍰",
        badges: ["vegetarian"],
      },
    ],
  },
  // ── listing-6 ──────────────────────────────────────────────────────────────
  {
    id: "listing-6",
    cookId: "cook-1",
    title: "Suya Express",
    description:
      "Amara's famous suya delivered hot. Spiced beef skewers with yaji, onions, and tomatoes — ready in your neighbourhood.",
    gradient: "linear-gradient(135deg, #e74c3c 0%, #a93226 100%)",
    image: "/placeholder.jpg",
    emoji: "🍢",
    pickupDate: "Sun Jun 7",
    pickupDateFull: "Sunday, June 7th",
    pickupWindow: "1pm – 6pm",
    orderDeadline: "Today",
    orderDeadlineShort: "Today",
    orderDeadlineIso: _hrs(8),
    maxOrders: 20,
    ordersLeft: 12,
    cuisineTypes: ["West African"],
    priceFrom: 20,
    orderType: "one-time",
    fulfillment: "delivery",
    deal: { badge: "$5 OFF", label: "Save $5 on suya delivery today" },
    distanceKm: 1.2,
    isNew: true,
    isSpotlight: false,
    isHighProtein: true,
    niches: ["high_protein", "comfort_food"],
    dishes: [
      {
        id: "dish-6-1",
        name: "Suya Skewers (6 pcs)",
        description: "Spiced grilled beef skewers with yaji and fresh onions.",
        price: 20,
        portionSize: "6 skewers",
        emoji: "🍢",
        badges: ["halal", "gluten-free"],
      },
      {
        id: "dish-6-2",
        name: "Suya Wrap",
        description:
          "Suya strips wrapped in flatbread with peppers and onions.",
        price: 18,
        portionSize: "1 wrap",
        emoji: "🌯",
        badges: ["halal"],
      },
    ],
  },
  // ── listing-7 ──────────────────────────────────────────────────────────────
  {
    id: "listing-7",
    cookId: "cook-2",
    title: "K-BBQ Box",
    description:
      "Everything you need for a Korean BBQ night at home. Marinated meats, dipping sauces, and banchan included.",
    gradient: "linear-gradient(135deg, #c0392b 0%, #7b241c 100%)",
    image: "/placeholder.jpg",
    emoji: "🥩",
    pickupDate: "Sat Jun 6",
    pickupDateFull: "Saturday, June 6th",
    pickupWindow: "3pm – 7pm",
    orderDeadline: "Tomorrow",
    orderDeadlineShort: "Tomorrow",
    orderDeadlineIso: _hrs(20),
    maxOrders: 10,
    ordersLeft: 6,
    cuisineTypes: ["Korean"],
    priceFrom: 28,
    orderType: "one-time",
    fulfillment: "both",
    deal: null,
    distanceKm: 2.4,
    isNew: true,
    isSpotlight: false,
    isHighProtein: true,
    niches: ["high_protein", "muscle_gain"],
    dishes: [
      {
        id: "dish-7-1",
        name: "BBQ Pack (4 proteins)",
        description:
          "Bulgogi, galbi, samgyeopsal, and dak galbi, marinated and ready to grill.",
        price: 52,
        portionSize: "Serves 2–3",
        emoji: "🥩",
        badges: ["gluten-free"],
      },
      {
        id: "dish-7-2",
        name: "Banchan Set",
        description: "5 house-made sides to go with your BBQ.",
        price: 18,
        portionSize: "Feeds 2",
        emoji: "🍱",
        badges: ["gluten-free"],
      },
    ],
  },
  // ── listing-8 ──────────────────────────────────────────────────────────────
  {
    id: "listing-8",
    cookId: "cook-4",
    title: "Halal Weekly Prep Box",
    description:
      "A weekly subscription box of Levantine home cooking. Proteins, sides, and fresh dips — enough for 3 dinners for 2.",
    gradient: "linear-gradient(135deg, #ca8a04 0%, #854d0e 100%)",
    image: "/placeholder.jpg",
    emoji: "📦",
    pickupDate: "Fri Jun 5",
    pickupDateFull: "Friday, June 5th",
    pickupWindow: "4pm – 7pm",
    orderDeadline: "Wed Jun 3, 11:59pm",
    orderDeadlineShort: "Wed Jun 3",
    orderDeadlineIso: _hrs(60),
    maxOrders: 12,
    ordersLeft: 9,
    cuisineTypes: ["Middle Eastern"],
    priceFrom: 22,
    orderType: "both",
    fulfillment: "delivery",
    deal: { badge: "10% OFF", label: "10% off your first box" },
    distanceKm: 5.8,
    isNew: false,
    isSpotlight: true,
    isHighProtein: false,
    niches: ["balanced", "heart_health"],
    dishes: [
      {
        id: "dish-8-1",
        name: "Weekly Protein (choice)",
        description:
          "Chicken shawarma, kofta, or grilled fish — rotates weekly.",
        price: 28,
        portionSize: "Serves 2",
        emoji: "🍗",
        badges: ["halal", "gluten-free"],
      },
      {
        id: "dish-8-2",
        name: "Sides + Dips",
        description: "Fattoush, tabbouleh, hummus, and warm pita.",
        price: 22,
        portionSize: "Serves 2",
        emoji: "🥗",
        badges: ["halal", "vegetarian"],
      },
    ],
  },
  // ── listing-9 ──────────────────────────────────────────────────────────────
  {
    id: "listing-9",
    cookId: "cook-6",
    title: "Priya's Thali Weekly",
    description:
      "A rotating weekly thali: dal, sabzi, roti, rice, pickle, and a sweet. Real home cooking, every week.",
    gradient: "linear-gradient(135deg, #e67e22 0%, #9b4e0a 100%)",
    image: "/placeholder.jpg",
    emoji: "🍛",
    pickupDate: "Sat Jun 6",
    pickupDateFull: "Saturday, June 6th",
    pickupWindow: "11am – 2pm",
    orderDeadline: "Thu Jun 4, 11:59pm",
    orderDeadlineShort: "Thu Jun 4",
    orderDeadlineIso: _hrs(36),
    maxOrders: 15,
    ordersLeft: 11,
    cuisineTypes: ["South Asian"],
    priceFrom: 19,
    orderType: "subscription",
    fulfillment: "both",
    deal: null,
    distanceKm: 0.5,
    isNew: true,
    isSpotlight: true,
    isHighProtein: true,
    niches: ["high_protein", "balanced"],
    dishes: [
      {
        id: "dish-9-1",
        name: "Thali (full)",
        description: "Dal tadka, aloo gobi, roti, rice, raita, and mithai.",
        price: 24,
        portionSize: "Serves 1",
        emoji: "🍛",
        badges: ["vegetarian"],
      },
      {
        id: "dish-9-2",
        name: "Thali (protein)",
        description: "Butter chicken, dal, rice, roti, and raita.",
        price: 28,
        portionSize: "Serves 1",
        emoji: "🍗",
        badges: ["gluten-free"],
      },
    ],
  },
  // ── listing-10 ─────────────────────────────────────────────────────────────
  {
    id: "listing-10",
    cookId: "cook-6",
    title: "Biryani Friday",
    description:
      "Priya's legendary dum biryani: slow-cooked with whole spices, served with raita and salan. Pickup only, limited spots.",
    gradient: "linear-gradient(135deg, #d4a017 0%, #8b6508 100%)",
    image: "/placeholder.jpg",
    emoji: "🍚",
    pickupDate: "Fri Jun 5",
    pickupDateFull: "Friday, June 5th",
    pickupWindow: "5pm – 8pm",
    orderDeadline: "Wed Jun 3, 11:59pm",
    orderDeadlineShort: "Wed Jun 3",
    orderDeadlineIso: _hrs(72),
    maxOrders: 8,
    ordersLeft: 3,
    cuisineTypes: ["South Asian"],
    priceFrom: 22,
    orderType: "one-time",
    fulfillment: "pickup",
    deal: { badge: "$12 OFF", label: "Save $12 on the family box" },
    distanceKm: 0.5,
    isNew: false,
    isSpotlight: false,
    isHighProtein: false,
    niches: ["comfort_food"],
    dishes: [
      {
        id: "dish-10-1",
        name: "Chicken Dum Biryani",
        description:
          "Slow-cooked bone-in chicken with basmati, whole spices, and crispy onions.",
        price: 26,
        portionSize: "Serves 2",
        emoji: "🍚",
        badges: ["gluten-free"],
      },
      {
        id: "dish-10-2",
        name: "Veg Biryani",
        description: "Mixed vegetable dum biryani with saffron and nuts.",
        price: 22,
        portionSize: "Serves 2",
        emoji: "🍚",
        badges: ["vegetarian", "gluten-free"],
      },
    ],
  },
  // ── listing-11 ─────────────────────────────────────────────────────────────
  {
    id: "listing-11",
    cookId: "cook-7",
    title: "Tonkotsu Ramen Kit",
    description:
      "18-hour pork bone broth with all the toppings, ready to heat and assemble at home. Chashu, noodles, eggs included.",
    gradient: "linear-gradient(135deg, #2c3e50 0%, #1a252f 100%)",
    image: "/placeholder.jpg",
    emoji: "🍜",
    pickupDate: "Sat Jun 6",
    pickupDateFull: "Saturday, June 6th",
    pickupWindow: "12pm – 5pm",
    orderDeadline: "Thu Jun 4, 11:59pm",
    orderDeadlineShort: "Thu Jun 4",
    orderDeadlineIso: _hrs(96),
    maxOrders: 12,
    ordersLeft: 8,
    cuisineTypes: ["Japanese"],
    priceFrom: 24,
    orderType: "one-time",
    fulfillment: "both",
    deal: null,
    distanceKm: 1.8,
    isNew: true,
    isSpotlight: false,
    isHighProtein: true,
    niches: ["high_protein", "comfort_food"],
    dishes: [
      {
        id: "dish-11-1",
        name: "Tonkotsu Kit (2 servings)",
        description:
          "Rich pork broth, chashu, soft-boiled eggs, noodles, and toppings.",
        price: 36,
        portionSize: "Serves 2",
        emoji: "🍜",
        badges: [],
      },
      {
        id: "dish-11-2",
        name: "Shoyu Kit (2 servings)",
        description:
          "Lighter soy-based broth with chicken chashu and bamboo shoots.",
        price: 30,
        portionSize: "Serves 2",
        emoji: "🍜",
        badges: [],
      },
    ],
  },
  // ── listing-12 ─────────────────────────────────────────────────────────────
  {
    id: "listing-12",
    cookId: "cook-7",
    title: "Bento Lunch Box",
    description:
      "Weekly bento subscription: rice, protein, pickled sides, and a miso soup packet. Ready to grab Monday morning.",
    gradient: "linear-gradient(135deg, #4a4e69 0%, #22223b 100%)",
    image: "/placeholder.jpg",
    emoji: "🍱",
    pickupDate: "Wed Jun 3",
    pickupDateFull: "Wednesday, June 3rd",
    pickupWindow: "7am – 10am",
    orderDeadline: "Today",
    orderDeadlineShort: "Today",
    orderDeadlineIso: _hrs(6),
    maxOrders: 20,
    ordersLeft: 7,
    cuisineTypes: ["Japanese"],
    priceFrom: 16,
    orderType: "subscription",
    fulfillment: "delivery",
    deal: null,
    distanceKm: 1.8,
    isNew: false,
    isSpotlight: false,
    isHighProtein: true,
    niches: ["high_protein", "balanced"],
    dishes: [
      {
        id: "dish-12-1",
        name: "Salmon Bento",
        description:
          "Teriyaki salmon, rice, tamagoyaki, pickled cucumber, edamame.",
        price: 19,
        portionSize: "1 bento",
        emoji: "🐟",
        badges: ["gluten-free"],
      },
      {
        id: "dish-12-2",
        name: "Chicken Karaage Bento",
        description:
          "Crispy karaage, rice, mayo, shredded cabbage, pickled ginger.",
        price: 16,
        portionSize: "1 bento",
        emoji: "🍗",
        badges: [],
      },
    ],
  },
  // ── listing-13 ─────────────────────────────────────────────────────────────
  {
    id: "listing-13",
    cookId: "cook-8",
    title: "Jerk Chicken Box",
    description:
      "Yolanda's world-famous jerk chicken — marinated overnight, cooked low and slow. Served with rice and peas and coleslaw.",
    gradient: "linear-gradient(135deg, #27ae60 0%, #1a6e3c 100%)",
    image: "/placeholder.jpg",
    emoji: "🌶️",
    pickupDate: "Sun Jun 7",
    pickupDateFull: "Sunday, June 7th",
    pickupWindow: "12pm – 5pm",
    orderDeadline: "Thu Jun 4, 11:59pm",
    orderDeadlineShort: "Thu Jun 4",
    orderDeadlineIso: _hrs(48),
    maxOrders: 15,
    ordersLeft: 9,
    cuisineTypes: ["Caribbean"],
    priceFrom: 22,
    orderType: "both",
    fulfillment: "pickup",
    deal: { badge: "20% OFF", label: "20% off this weekend" },
    distanceKm: 3.7,
    isNew: true,
    isSpotlight: false,
    isHighProtein: true,
    niches: ["high_protein", "comfort_food"],
    dishes: [
      {
        id: "dish-13-1",
        name: "Jerk Chicken Half",
        description: "Half chicken, jerk marinade, rice and peas, coleslaw.",
        price: 26,
        portionSize: "Serves 1–2",
        emoji: "🍗",
        badges: ["gluten-free", "dairy-free"],
      },
      {
        id: "dish-13-2",
        name: "Jerk Chicken Whole",
        description:
          "Full bird, jerk marinade, rice and peas, coleslaw, festival.",
        price: 44,
        portionSize: "Serves 3–4",
        emoji: "🍗",
        badges: ["gluten-free", "dairy-free"],
      },
    ],
  },
  // ── listing-14 ─────────────────────────────────────────────────────────────
  {
    id: "listing-14",
    cookId: "cook-8",
    title: "Caribbean Stew Weekly",
    description:
      "A weekly rotation of Yolanda's hearty Caribbean stews: curry goat, oxtail, or stew chicken. With rice and peas.",
    gradient: "linear-gradient(135deg, #16a085 0%, #0e6655 100%)",
    image: "/placeholder.jpg",
    emoji: "🍲",
    pickupDate: "Sat Jun 6",
    pickupDateFull: "Saturday, June 6th",
    pickupWindow: "1pm – 5pm",
    orderDeadline: "Wed Jun 3, 11:59pm",
    orderDeadlineShort: "Wed Jun 3",
    orderDeadlineIso: _hrs(72),
    maxOrders: 10,
    ordersLeft: 6,
    cuisineTypes: ["Caribbean"],
    priceFrom: 24,
    orderType: "subscription",
    fulfillment: "both",
    deal: null,
    distanceKm: 3.7,
    isNew: false,
    isSpotlight: true,
    isHighProtein: false,
    niches: ["comfort_food"],
    dishes: [
      {
        id: "dish-14-1",
        name: "Curry Goat",
        description:
          "Slow-braised goat in a Scotch bonnet curry with rice and peas.",
        price: 28,
        portionSize: "Serves 2",
        emoji: "🍲",
        badges: ["gluten-free", "dairy-free"],
      },
      {
        id: "dish-14-2",
        name: "Oxtail Stew",
        description:
          "Rich, fall-off-the-bone oxtail braised with butter beans.",
        price: 32,
        portionSize: "Serves 2",
        emoji: "🥘",
        badges: ["gluten-free", "dairy-free"],
      },
    ],
  },
  // ── listing-15 ─────────────────────────────────────────────────────────────
  {
    id: "listing-15",
    cookId: "cook-5",
    title: "Pasta Alla Norma",
    description:
      "Nadia's weeknight pasta: rigatoni with roasted aubergine, San Marzano tomatoes, ricotta salata, and fresh basil.",
    gradient: "linear-gradient(135deg, #8e44ad 0%, #5b2c6f 100%)",
    image: "/placeholder.jpg",
    emoji: "🍆",
    pickupDate: "Sun Jun 7",
    pickupDateFull: "Sunday, June 7th",
    pickupWindow: "3pm – 6pm",
    orderDeadline: "Fri Jun 5, 11:59pm",
    orderDeadlineShort: "Fri Jun 5",
    orderDeadlineIso: _hrs(40),
    maxOrders: 8,
    ordersLeft: 5,
    cuisineTypes: ["Italian"],
    priceFrom: 20,
    orderType: "one-time",
    fulfillment: "both",
    deal: null,
    distanceKm: 3.1,
    isNew: true,
    isSpotlight: false,
    isHighProtein: false,
    niches: ["comfort_food"],
    dishes: [
      {
        id: "dish-15-1",
        name: "Pasta Alla Norma (2 portions)",
        description:
          "Rigatoni with roasted aubergine, San Marzano tomatoes, and ricotta salata.",
        price: 22,
        portionSize: "Serves 2",
        emoji: "🍆",
        badges: ["vegetarian"],
      },
      {
        id: "dish-15-2",
        name: "Arancini (4 pcs)",
        description: "Crispy saffron rice balls filled with mozzarella.",
        price: 16,
        portionSize: "4 pieces",
        emoji: "🧆",
        badges: ["vegetarian"],
      },
    ],
  },
  // ── listing-16 ─────────────────────────────────────────────────────────────
  {
    id: "listing-16",
    cookId: "cook-3",
    title: "Açaí Bowl Bundle",
    description:
      "Fresh açaí bowls delivered to your door. Topped with granola, banana, and honey. Healthy, filling, and fast.",
    gradient: "linear-gradient(135deg, #6c3483 0%, #4a235a 100%)",
    image: "/placeholder.jpg",
    emoji: "🫐",
    pickupDate: "Thu Jun 4",
    pickupDateFull: "Thursday, June 4th",
    pickupWindow: "8am – 12pm",
    orderDeadline: "Today",
    orderDeadlineShort: "Today",
    orderDeadlineIso: _hrs(10),
    maxOrders: 25,
    ordersLeft: 14,
    cuisineTypes: ["Brazilian"],
    priceFrom: 12,
    orderType: "one-time",
    fulfillment: "delivery",
    deal: { badge: "$10 OFF", label: "Save $10 when you order 2 bowls" },
    distanceKm: 0.8,
    isNew: false,
    isSpotlight: false,
    isHighProtein: false,
    niches: ["heart_health", "weight_loss"],
    dishes: [
      {
        id: "dish-16-1",
        name: "Classic Açaí Bowl",
        description: "Açaí blend, granola, banana, honey, and coconut flakes.",
        price: 14,
        portionSize: "Regular (500ml)",
        emoji: "🫐",
        badges: ["vegan", "gluten-free", "dairy-free"],
      },
      {
        id: "dish-16-2",
        name: "Protein Açaí Bowl",
        description: "Açaí with hemp seeds, nut butter, and protein granola.",
        price: 16,
        portionSize: "Regular (500ml)",
        emoji: "💪",
        badges: ["vegan", "dairy-free"],
      },
    ],
  },
  // ── listing-17 ─────────────────────────────────────────────────────────────
  {
    id: "listing-17",
    cookId: "cook-1",
    title: "Pepper Soup & Pepper Rice",
    description:
      "Amara's Sunday special: aromatic West African pepper soup with goat or chicken, served alongside fragrant pepper rice.",
    gradient: "linear-gradient(135deg, #c0392b 0%, #641e16 100%)",
    image: "/placeholder.jpg",
    emoji: "🌶️",
    pickupDate: "Fri Jun 5",
    pickupDateFull: "Friday, June 5th",
    pickupWindow: "2pm – 7pm",
    orderDeadline: "Wed Jun 3, 11:59pm",
    orderDeadlineShort: "Wed Jun 3",
    orderDeadlineIso: _hrs(108),
    maxOrders: 10,
    ordersLeft: 8,
    cuisineTypes: ["West African"],
    priceFrom: 20,
    orderType: "one-time",
    fulfillment: "both",
    deal: null,
    distanceKm: 1.2,
    isNew: false,
    isSpotlight: false,
    isHighProtein: true,
    niches: ["high_protein", "comfort_food"],
    dishes: [
      {
        id: "dish-17-1",
        name: "Pepper Soup (goat)",
        description:
          "Spiced goat broth with uziza leaves — warming and intensely flavoured.",
        price: 24,
        portionSize: "Serves 1–2",
        emoji: "🍲",
        badges: ["halal", "gluten-free"],
      },
      {
        id: "dish-17-2",
        name: "Pepper Rice",
        description:
          "Fragrant long-grain rice cooked with peppers, crayfish, and palm oil.",
        price: 20,
        portionSize: "Serves 2",
        emoji: "🌶️",
        badges: ["halal", "gluten-free"],
      },
    ],
  },
  // ── listing-18 ─────────────────────────────────────────────────────────────
  {
    id: "listing-18",
    cookId: "cook-4",
    title: "Shawarma Friday",
    description:
      "Fatima's famous chicken shawarma — marinated 24 hours, roasted on a spit, wrapped in warm bread with garlic sauce.",
    gradient: "linear-gradient(135deg, #b7950b 0%, #7d6608 100%)",
    image: "/placeholder.jpg",
    emoji: "🌯",
    pickupDate: "Sat Jun 6",
    pickupDateFull: "Saturday, June 6th",
    pickupWindow: "12pm – 6pm",
    orderDeadline: "Tomorrow",
    orderDeadlineShort: "Tomorrow",
    orderDeadlineIso: _hrs(22),
    maxOrders: 30,
    ordersLeft: 18,
    cuisineTypes: ["Middle Eastern"],
    priceFrom: 16,
    orderType: "one-time",
    fulfillment: "both",
    deal: { badge: "20% OFF", label: "20% off shawarma wraps" },
    distanceKm: 5.8,
    isNew: false,
    isSpotlight: false,
    isHighProtein: true,
    niches: ["high_protein", "comfort_food"],
    dishes: [
      {
        id: "dish-18-1",
        name: "Chicken Shawarma Wrap",
        description:
          "Slow-roasted chicken, garlic sauce, pickles, tomatoes in warm bread.",
        price: 16,
        portionSize: "1 wrap",
        emoji: "🌯",
        badges: ["halal", "dairy-free"],
      },
      {
        id: "dish-18-2",
        name: "Shawarma Plate",
        description:
          "Sliced shawarma over rice with fattoush and garlic sauce.",
        price: 22,
        portionSize: "Serves 1",
        emoji: "🍽️",
        badges: ["halal", "gluten-free"],
      },
    ],
  },
  // ── listing-19 ─────────────────────────────────────────────────────────────
  {
    id: "listing-19",
    cookId: "cook-6",
    title: "Protein Thali",
    description:
      "A high-protein weekly subscription: paneer or chicken, dal, roti, and raita. Built for gym-goers and serious eaters.",
    gradient: "linear-gradient(135deg, #e74c3c 0%, #b03a2e 100%)",
    image: "/placeholder.jpg",
    emoji: "💪",
    pickupDate: "Thu Jun 4",
    pickupDateFull: "Thursday, June 4th",
    pickupWindow: "6pm – 9pm",
    orderDeadline: "Tue Jun 3, 11:59pm",
    orderDeadlineShort: "Tue Jun 3",
    orderDeadlineIso: _hrs(60),
    maxOrders: 12,
    ordersLeft: 10,
    cuisineTypes: ["South Asian"],
    priceFrom: 22,
    orderType: "subscription",
    fulfillment: "both",
    deal: null,
    distanceKm: 0.5,
    isNew: false,
    isSpotlight: false,
    isHighProtein: true,
    niches: ["high_protein", "muscle_gain"],
    dishes: [
      {
        id: "dish-19-1",
        name: "Chicken Protein Thali",
        description:
          "Tandoori chicken, dal makhani, roti, and raita. ~60g protein.",
        price: 28,
        portionSize: "Serves 1",
        emoji: "🍗",
        badges: ["gluten-free"],
      },
      {
        id: "dish-19-2",
        name: "Paneer Protein Thali",
        description:
          "Shahi paneer, chana masala, roti, and raita. ~45g protein.",
        price: 24,
        portionSize: "Serves 1",
        emoji: "🧀",
        badges: ["vegetarian", "gluten-free"],
      },
    ],
  },
  // ── listing-20 ─────────────────────────────────────────────────────────────
  {
    id: "listing-20",
    cookId: "cook-2",
    title: "Kimchi Making Kit",
    description:
      "Make your own kimchi at home with Ji-won's kit: pre-cut napa cabbage, house-made paste, and a step-by-step guide.",
    gradient: "linear-gradient(135deg, #bf2026 0%, #6e0a0e 100%)",
    image: "/placeholder.jpg",
    emoji: "🥬",
    pickupDate: "Sun Jun 7",
    pickupDateFull: "Sunday, June 7th",
    pickupWindow: "11am – 3pm",
    orderDeadline: "Fri Jun 5, 11:59pm",
    orderDeadlineShort: "Fri Jun 5",
    orderDeadlineIso: _hrs(120),
    maxOrders: 20,
    ordersLeft: 15,
    cuisineTypes: ["Korean"],
    priceFrom: 28,
    orderType: "both",
    fulfillment: "pickup",
    deal: { badge: "$8 OFF", label: "$8 off your first batch kit" },
    distanceKm: 2.4,
    isNew: true,
    isSpotlight: false,
    isHighProtein: false,
    niches: ["balanced"],
    dishes: [
      {
        id: "dish-20-1",
        name: "Kimchi Kit (1kg batch)",
        description: "Everything to make 1kg of baechu kimchi at home.",
        price: 28,
        portionSize: "Makes 1kg",
        emoji: "🥬",
        badges: ["vegan", "gluten-free"],
      },
      {
        id: "dish-20-2",
        name: "Kimchi Kit (2kg batch)",
        description: "Double batch with extra paste and a fermentation guide.",
        price: 48,
        portionSize: "Makes 2kg",
        emoji: "🥬",
        badges: ["vegan", "gluten-free"],
      },
    ],
  },
  // ── listing-21 ─────────────────────────────────────────────────────────────
  {
    id: "listing-21",
    cookId: "cook-1",
    title: "Ofada Rice & Ayamase Stew",
    description:
      "Nigerian green pepper stew (ofada sauce) with local rice and assorted meats. Bold, smoky, and unapologetically spicy.",
    gradient: "linear-gradient(135deg, #e74c3c 0%, #922b21 100%)",
    image: "/placeholder.jpg",
    emoji: "🫕",
    pickupDate: "Sat Jun 6",
    pickupDateFull: "Saturday, June 6th",
    pickupWindow: "12pm – 5pm",
    orderDeadline: "Thu Jun 4, 11:59pm",
    orderDeadlineShort: "Thu Jun 4",
    orderDeadlineIso: _hrs(80),
    maxOrders: 10,
    ordersLeft: 7,
    cuisineTypes: ["West African"],
    priceFrom: 22,
    orderType: "one-time",
    fulfillment: "both",
    deal: null,
    distanceKm: 1.2,
    isNew: true,
    isSpotlight: true,
    isHighProtein: true,
    niches: ["high_protein", "comfort_food"],
    dishes: [
      {
        id: "dish-21-1",
        name: "Ofada Rice + Ayamase Stew",
        description: "Local rice with green pepper stew and assorted meats.",
        price: 24,
        portionSize: "Serves 2",
        emoji: "🫕",
        badges: ["halal", "gluten-free"],
      },
      {
        id: "dish-21-2",
        name: "Moimoi (Bean Pudding)",
        description: "Steamed black-eyed pea pudding, soft and savoury.",
        price: 14,
        portionSize: "2 portions",
        emoji: "🫘",
        badges: ["halal", "gluten-free"],
      },
    ],
  },
  // ── listing-22 ─────────────────────────────────────────────────────────────
  {
    id: "listing-22",
    cookId: "cook-4",
    title: "Falafel & Hummus Box",
    description:
      "Crispy falafel made from scratch, served with house hummus, pickled veg, and warm pita. 100% plant-based and halal.",
    gradient: "linear-gradient(135deg, #5d8a3c 0%, #3a5c24 100%)",
    image: "/placeholder.jpg",
    emoji: "🧆",
    pickupDate: "Fri Jun 5",
    pickupDateFull: "Friday, June 5th",
    pickupWindow: "3pm – 7pm",
    orderDeadline: "Wed Jun 3, 11:59pm",
    orderDeadlineShort: "Wed Jun 3",
    orderDeadlineIso: _hrs(55),
    maxOrders: 20,
    ordersLeft: 14,
    cuisineTypes: ["Middle Eastern"],
    priceFrom: 16,
    orderType: "one-time",
    fulfillment: "both",
    deal: null,
    distanceKm: 5.8,
    isNew: true,
    isSpotlight: false,
    isHighProtein: false,
    niches: ["balanced", "heart_health"],
    dishes: [
      {
        id: "dish-22-1",
        name: "Falafel Box (8 pcs)",
        description: "Crispy falafel with tahini, pickles, and pita.",
        price: 18,
        portionSize: "8 pieces",
        emoji: "🧆",
        badges: ["halal", "vegan", "dairy-free"],
      },
      {
        id: "dish-22-2",
        name: "Hummus Bowl",
        description: "House hummus with olive oil, paprika, and warm bread.",
        price: 16,
        portionSize: "Serves 2",
        emoji: "🫙",
        badges: ["halal", "vegan", "dairy-free"],
      },
    ],
  },
  // ── listing-23 ─────────────────────────────────────────────────────────────
  {
    id: "listing-23",
    cookId: "cook-4",
    title: "Lebanese Family Feast",
    description:
      "A spread for 4–6: whole roasted chicken, kibbeh, fattoush, rice and vermicelli, and a platter of mezze dips.",
    gradient: "linear-gradient(135deg, #c0984e 0%, #8a6830 100%)",
    image: "/placeholder.jpg",
    emoji: "🍽️",
    pickupDate: "Sun Jun 7",
    pickupDateFull: "Sunday, June 7th",
    pickupWindow: "1pm – 5pm",
    orderDeadline: "Thu Jun 4, 11:59pm",
    orderDeadlineShort: "Thu Jun 4",
    orderDeadlineIso: _hrs(90),
    maxOrders: 6,
    ordersLeft: 4,
    cuisineTypes: ["Middle Eastern"],
    priceFrom: 45,
    orderType: "one-time",
    fulfillment: "pickup",
    deal: null,
    distanceKm: 5.8,
    isNew: false,
    isSpotlight: true,
    isHighProtein: false,
    niches: ["comfort_food"],
    dishes: [
      {
        id: "dish-23-1",
        name: "Family Feast (serves 4–6)",
        description:
          "Whole roasted chicken, kibbeh, fattoush, rice, and mezze dips.",
        price: 75,
        portionSize: "Serves 4–6",
        emoji: "🍽️",
        badges: ["halal", "dairy-free"],
      },
    ],
  },
  // ── listing-24 ─────────────────────────────────────────────────────────────
  {
    id: "listing-24",
    cookId: "cook-2",
    title: "Japchae Meal Prep",
    description:
      "Glass noodles stir-fried with beef, spinach, mushrooms, and sesame. A weekly subscription for serious Korean food fans.",
    gradient: "linear-gradient(135deg, #a84240 0%, #6e2020 100%)",
    image: "/placeholder.jpg",
    emoji: "🍜",
    pickupDate: "Sat Jun 6",
    pickupDateFull: "Saturday, June 6th",
    pickupWindow: "11am – 3pm",
    orderDeadline: "Thu Jun 4, 11:59pm",
    orderDeadlineShort: "Thu Jun 4",
    orderDeadlineIso: _hrs(65),
    maxOrders: 12,
    ordersLeft: 9,
    cuisineTypes: ["Korean"],
    priceFrom: 20,
    orderType: "subscription",
    fulfillment: "both",
    deal: null,
    distanceKm: 2.4,
    isNew: true,
    isSpotlight: true,
    isHighProtein: false,
    niches: ["balanced", "comfort_food"],
    dishes: [
      {
        id: "dish-24-1",
        name: "Japchae (2 portions)",
        description: "Glass noodles with beef, mushrooms, spinach, and sesame.",
        price: 22,
        portionSize: "Serves 2",
        emoji: "🍜",
        badges: ["gluten-free"],
      },
      {
        id: "dish-24-2",
        name: "Japchae Veg (2 portions)",
        description: "Glass noodles with tofu, mushrooms, and spinach.",
        price: 20,
        portionSize: "Serves 2",
        emoji: "🍜",
        badges: ["vegetarian", "gluten-free"],
      },
    ],
  },
  // ── listing-25 ─────────────────────────────────────────────────────────────
  {
    id: "listing-25",
    cookId: "cook-6",
    title: "Dal Tadka & Roti Weekly",
    description:
      "Priya's weekly comfort staple: silky yellow dal with a smoky tadka, served with freshly made roti and pickle.",
    gradient: "linear-gradient(135deg, #f0a500 0%, #b07500 100%)",
    image: "/placeholder.jpg",
    emoji: "🍛",
    pickupDate: "Thu Jun 4",
    pickupDateFull: "Thursday, June 4th",
    pickupWindow: "5pm – 8pm",
    orderDeadline: "Tue Jun 2, 11:59pm",
    orderDeadlineShort: "Tue Jun 2",
    orderDeadlineIso: _hrs(85),
    maxOrders: 15,
    ordersLeft: 10,
    cuisineTypes: ["South Asian"],
    priceFrom: 16,
    orderType: "subscription",
    fulfillment: "delivery",
    deal: null,
    distanceKm: 0.5,
    isNew: false,
    isSpotlight: true,
    isHighProtein: false,
    niches: ["balanced", "comfort_food"],
    dishes: [
      {
        id: "dish-25-1",
        name: "Dal Tadka + 4 Roti",
        description:
          "Yellow dal with ghee tadka and cumin, served with fresh roti.",
        price: 18,
        portionSize: "Serves 1–2",
        emoji: "🍛",
        badges: ["vegetarian", "gluten-free"],
      },
      {
        id: "dish-25-2",
        name: "Dal Makhani + 4 Roti",
        description: "Slow-cooked black lentil dal with butter and cream.",
        price: 20,
        portionSize: "Serves 1–2",
        emoji: "🫘",
        badges: ["vegetarian"],
      },
    ],
  },
  // ── listing-26 ─────────────────────────────────────────────────────────────
  {
    id: "listing-26",
    cookId: "cook-7",
    title: "Onigiri Variety Pack",
    description:
      "5 hand-pressed rice balls with rotating fillings: salmon, tuna mayo, pickled plum, kombu, and teriyaki chicken.",
    gradient: "linear-gradient(135deg, #3d5a80 0%, #1e2f45 100%)",
    image: "/placeholder.jpg",
    emoji: "🍙",
    pickupDate: "Wed Jun 3",
    pickupDateFull: "Wednesday, June 3rd",
    pickupWindow: "11am – 2pm",
    orderDeadline: "Today",
    orderDeadlineShort: "Today",
    orderDeadlineIso: _hrs(30),
    maxOrders: 30,
    ordersLeft: 20,
    cuisineTypes: ["Japanese"],
    priceFrom: 18,
    orderType: "one-time",
    fulfillment: "pickup",
    deal: { badge: "$6 OFF", label: "$6 off the lunch bundle" },
    distanceKm: 1.8,
    isNew: true,
    isSpotlight: false,
    isHighProtein: false,
    niches: ["balanced"],
    dishes: [
      {
        id: "dish-26-1",
        name: "Onigiri Pack (5 pcs)",
        description: "5 onigiri with mixed fillings, wrapped in nori.",
        price: 18,
        portionSize: "5 pieces",
        emoji: "🍙",
        badges: ["gluten-free"],
      },
    ],
  },
  // ── listing-27 ─────────────────────────────────────────────────────────────
  {
    id: "listing-27",
    cookId: "cook-5",
    title: "Osso Buco & Saffron Polenta",
    description:
      "Braised veal shanks in white wine and gremolata, served over creamy saffron polenta. Nadia's Sunday showstopper.",
    gradient: "linear-gradient(135deg, #7d4e1e 0%, #4a2c0a 100%)",
    image: "/placeholder.jpg",
    emoji: "🍖",
    pickupDate: "Sun Jun 7",
    pickupDateFull: "Sunday, June 7th",
    pickupWindow: "2pm – 6pm",
    orderDeadline: "Fri Jun 5, 11:59pm",
    orderDeadlineShort: "Fri Jun 5",
    orderDeadlineIso: _hrs(100),
    maxOrders: 8,
    ordersLeft: 5,
    cuisineTypes: ["Italian"],
    priceFrom: 32,
    orderType: "both",
    fulfillment: "both",
    deal: { badge: "15% OFF", label: "15% off this weekend" },
    distanceKm: 3.1,
    isNew: false,
    isSpotlight: true,
    isHighProtein: true,
    niches: ["high_protein", "comfort_food"],
    dishes: [
      {
        id: "dish-27-1",
        name: "Osso Buco + Polenta",
        description: "Braised veal shank with gremolata over saffron polenta.",
        price: 38,
        portionSize: "Serves 2",
        emoji: "🍖",
        badges: [],
      },
      {
        id: "dish-27-2",
        name: "Polenta Bowl (veg)",
        description:
          "Creamy saffron polenta with roasted mushrooms and parmesan.",
        price: 24,
        portionSize: "Serves 2",
        emoji: "🌽",
        badges: ["vegetarian"],
      },
    ],
  },
  // ── listing-28 ─────────────────────────────────────────────────────────────
  {
    id: "listing-28",
    cookId: "cook-3",
    title: "Açaí & Tapioca Breakfast",
    description:
      "Brazilian breakfast staple: thick açaí with banana and granola, plus tapioca crepes with cheese or Nutella.",
    gradient: "linear-gradient(135deg, #7b2d8b 0%, #4a1a54 100%)",
    image: "/placeholder.jpg",
    emoji: "🫐",
    pickupDate: "Sat Jun 6",
    pickupDateFull: "Saturday, June 6th",
    pickupWindow: "8am – 11am",
    orderDeadline: "Thu Jun 4, 11:59pm",
    orderDeadlineShort: "Thu Jun 4",
    orderDeadlineIso: _hrs(70),
    maxOrders: 20,
    ordersLeft: 15,
    cuisineTypes: ["Brazilian"],
    priceFrom: 12,
    orderType: "one-time",
    fulfillment: "both",
    deal: null,
    distanceKm: 0.8,
    isNew: true,
    isSpotlight: true,
    isHighProtein: false,
    niches: ["balanced", "heart_health"],
    dishes: [
      {
        id: "dish-28-1",
        name: "Açaí Bowl",
        description: "Thick açaí with banana, granola, and honey.",
        price: 14,
        portionSize: "Regular",
        emoji: "🫐",
        badges: ["vegan", "gluten-free", "dairy-free"],
      },
      {
        id: "dish-28-2",
        name: "Tapioca Crepe",
        description: "Gluten-free tapioca crepe with cheese or Nutella.",
        price: 12,
        portionSize: "1 crepe",
        emoji: "🥞",
        badges: ["gluten-free"],
      },
    ],
  },
  // ── listing-29 ─────────────────────────────────────────────────────────────
  {
    id: "listing-29",
    cookId: "cook-8",
    title: "Curry Goat Tacos",
    description:
      "Yolanda's fusion: slow-braised curry goat in a roti shell with mango slaw and scotch bonnet sauce. Limited run.",
    gradient: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
    image: "/placeholder.jpg",
    emoji: "🌮",
    pickupDate: "Sat Jun 6",
    pickupDateFull: "Saturday, June 6th",
    pickupWindow: "12pm – 5pm",
    orderDeadline: "Wed Jun 3, 11:59pm",
    orderDeadlineShort: "Wed Jun 3",
    orderDeadlineIso: _hrs(45),
    maxOrders: 20,
    ordersLeft: 12,
    cuisineTypes: ["Caribbean"],
    priceFrom: 16,
    orderType: "both",
    fulfillment: "both",
    deal: { badge: "$8 OFF", label: "Save $8 on curry goat tacos" },
    distanceKm: 3.7,
    isNew: true,
    isSpotlight: true,
    isHighProtein: true,
    niches: ["high_protein", "comfort_food"],
    dishes: [
      {
        id: "dish-29-1",
        name: "Curry Goat Tacos (3 pcs)",
        description: "Slow-braised curry goat in roti shells with mango slaw.",
        price: 20,
        portionSize: "3 tacos",
        emoji: "🌮",
        badges: ["gluten-free", "dairy-free"],
      },
      {
        id: "dish-29-2",
        name: "Plantain & Rice Side",
        description: "Fried sweet plantain with coconut rice.",
        price: 12,
        portionSize: "Serves 1",
        emoji: "🍌",
        badges: ["vegan", "gluten-free", "dairy-free"],
      },
    ],
  },
];

// ─── Orders ──────────────────────────────────────────────────────────────────

export const MOCK_ORDERS: MockOrder[] = [
  {
    id: "order-1",
    cookId: "cook-1",
    cookName: "Amara Diallo",
    cookInitials: "AD",
    listingTitle: "West African Weekend Feast",
    listingGradient: "linear-gradient(135deg, #c0392b 0%, #8e1a10 100%)",
    listingEmoji: "🥘",
    pickupDate: "Sat Jun 6",
    pickupWindow: "12pm – 5pm",
    dishes: [
      { name: "Jollof Rice (Party Style)", quantity: 1, price: 18 },
      { name: "Suya Skewers (6 pcs)", quantity: 2, price: 20 },
    ],
    subtotal: 58,
    serviceFee: 3,
    total: 61,
    status: "confirmed",
    pickupCode: "7E-4829",
    pickupAddress: "248 Roncesvalles Ave, Toronto",
  },
  {
    id: "order-2",
    cookId: "cook-2",
    cookName: "Ji-won Park",
    cookInitials: "JP",
    listingTitle: "Korean Banchan Box",
    listingGradient: "linear-gradient(135deg, #bf2026 0%, #6e0a0e 100%)",
    listingEmoji: "🍱",
    pickupDate: "Sat May 24",
    pickupWindow: "5pm – 8pm",
    dishes: [
      { name: "Banchan Box (5 sides)", quantity: 1, price: 24 },
      { name: "Galbi (Short Ribs)", quantity: 1, price: 32 },
    ],
    subtotal: 56,
    serviceFee: 3,
    total: 59,
    status: "completed",
    pickupCode: "7E-3311",
    pickupAddress: "91 Christie St, Toronto",
  },
];

// ─── Messages ─────────────────────────────────────────────────────────────────

export const MOCK_MESSAGE_THREADS: MockMessageThread[] = [
  {
    id: "thread-1",
    cookId: "cook-1",
    cookName: "Amara Diallo",
    cookInitials: "AD",
    cookGradient: COOK_AVATAR_GRADIENTS["cook-1"],
    preview: "Your order is confirmed! See you Saturday 😊",
    timestamp: "2h ago",
    unread: true,
    messages: [
      {
        id: "m1",
        from: "client",
        text: "Hi Amara! Can I swap the Egusi for an extra Jollof Rice?",
        timestamp: "10:14 AM",
      },
      {
        id: "m2",
        from: "cook",
        text: "Of course! I'll note that for your order. No problem at all 😊",
        timestamp: "10:31 AM",
      },
      {
        id: "m3",
        from: "cook",
        text: "Your order is confirmed! See you Saturday 😊",
        timestamp: "2h ago",
      },
    ],
  },
  {
    id: "thread-2",
    cookId: "cook-2",
    cookName: "Ji-won Park",
    cookInitials: "JP",
    cookGradient: COOK_AVATAR_GRADIENTS["cook-2"],
    preview: "Thanks for the 5-star review! 🙏",
    timestamp: "3 days ago",
    unread: false,
    messages: [
      {
        id: "m4",
        from: "client",
        text: "The galbi was INCREDIBLE. 10/10 would order again.",
        timestamp: "3 days ago",
      },
      {
        id: "m5",
        from: "cook",
        text: "Thanks for the 5-star review! 🙏",
        timestamp: "3 days ago",
      },
    ],
  },
];

// ─── Preference Sheet ─────────────────────────────────────────────────────────

export const PREFERENCE_QUESTIONS: PreferenceQuestion[] = [
  {
    id: "diet",
    question: "Any dietary restrictions or preferences?",
    options: [
      "None",
      "Halal",
      "Vegetarian",
      "Vegan",
      "Gluten-free",
      "Dairy-free",
      "Nut-free",
      "Kosher",
    ],
    multiSelect: true,
  },
  {
    id: "spice",
    question: "How spicy do you like your food?",
    options: ["Not spicy", "Mild", "Medium", "Hot", "Extra hot 🔥"],
    multiSelect: false,
  },
  {
    id: "group",
    question: "How many people do you usually order for?",
    options: ["Just me", "2 people", "3–4 people", "5+ people"],
    multiSelect: false,
  },
  {
    id: "cuisine",
    question: "What cuisines excite you most?",
    options: [
      "West African",
      "Korean",
      "Brazilian",
      "Middle Eastern",
      "Italian",
      "Caribbean",
      "South Asian",
      "East Asian",
      "Latin American",
    ],
    multiSelect: true,
  },
  {
    id: "frequency",
    question: "How often do you meal prep?",
    options: [
      "Never tried it",
      "Occasionally",
      "Weekly",
      "Multiple times a week",
    ],
    multiSelect: false,
  },
];

// ─── Reviews ──────────────────────────────────────────────────────────────────

export type MockReview = {
  id: string;
  clientName: string;
  clientInitials: string;
  rating: number;
  comment: string;
  date: string;
  orderedDish: string;
};

export const MOCK_REVIEWS: Record<string, MockReview[]> = {
  "cook-1": [
    {
      id: "r1",
      clientName: "Marcus R.",
      clientInitials: "MR",
      rating: 5,
      comment:
        "The jollof rice brought me right back home. Smoky, perfectly spiced, generous portions. Will be ordering every week.",
      date: "May 28",
      orderedDish: "Jollof Rice (Party Style)",
    },
    {
      id: "r2",
      clientName: "Zara T.",
      clientInitials: "ZT",
      rating: 5,
      comment:
        "Suya skewers were 🔥 Exactly the right amount of spice. Amara is so sweet and communicative too.",
      date: "May 21",
      orderedDish: "Suya Skewers",
    },
    {
      id: "r3",
      clientName: "Daniel K.",
      clientInitials: "DK",
      rating: 4,
      comment:
        "Egusi stew was excellent. The fufu could have been a little softer but overall a great meal.",
      date: "May 14",
      orderedDish: "Egusi Stew + Fufu",
    },
  ],
  "cook-2": [
    {
      id: "r4",
      clientName: "Hana S.",
      clientInitials: "HS",
      rating: 5,
      comment:
        "Ji-won's banchan is unreal. I grew up eating Korean food and this tastes like what my mom makes.",
      date: "May 25",
      orderedDish: "Banchan Box",
    },
    {
      id: "r5",
      clientName: "Tom W.",
      clientInitials: "TW",
      rating: 5,
      comment:
        "Galbi was perfectly tender. Easily the best home-cooked Korean food I've had in Toronto.",
      date: "May 18",
      orderedDish: "Galbi (Short Ribs)",
    },
  ],
};
