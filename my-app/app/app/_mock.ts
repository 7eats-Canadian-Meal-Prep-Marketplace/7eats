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
  | "Japanese";

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
  emoji: string;
  pickupDate: string;
  pickupDateFull: string;
  pickupWindow: string;
  orderDeadline: string;
  orderDeadlineShort: string;
  maxOrders: number;
  ordersLeft: number;
  dishes: MockDish[];
  cuisineTypes: CuisineType[];
  priceFrom: number;
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

export const MOCK_COOKS: MockCook[] = [
  {
    id: "cook-1",
    displayName: "Amara Diallo",
    bio: "Bringing the rich, bold flavours of West Africa to Toronto — one home-cooked meal at a time. Every dish is made with love, fresh ingredients, and my grandmother's secret recipes. Specializing in Jollof Rice, Egusi, and Suya.",
    cuisineTypes: ["West African"],
    initials: "AD",
    gradient: "linear-gradient(135deg, #c0392b 0%, #8e1a10 100%)",
    rating: 4.9,
    reviewCount: 47,
    neighborhood: "Roncesvalles",
    city: "Toronto",
    badges: ["halal"],
    leadTime: "Order 48h in advance",
    verified: true,
    emoji: "🥘",
    listingIds: ["listing-1"],
  },
  {
    id: "cook-2",
    displayName: "Ji-won Park",
    bio: "Korean home cooking made with the freshest ingredients. I make the banchan my halmeoni taught me — kimchi, japchae, galbi, and more. Everything is made to order, with no shortcuts.",
    cuisineTypes: ["Korean"],
    initials: "JP",
    gradient: "linear-gradient(135deg, #bf2026 0%, #6e0a0e 100%)",
    rating: 4.8,
    reviewCount: 31,
    neighborhood: "Christie Pits",
    city: "Toronto",
    badges: ["gluten-free"],
    leadTime: "Order 24h in advance",
    verified: true,
    emoji: "🍲",
    listingIds: ["listing-2"],
  },
  {
    id: "cook-3",
    displayName: "Maria Santos",
    bio: "From São Paulo to your table. Feijoada, coxinha, brigadeiros — every bite is a trip home. I cook in large batches every Friday and Saturday for weekend pickup.",
    cuisineTypes: ["Brazilian"],
    initials: "MS",
    gradient: "linear-gradient(135deg, #1a7a4a 0%, #0d4a2a 100%)",
    rating: 4.7,
    reviewCount: 22,
    neighborhood: "Kensington Market",
    city: "Toronto",
    badges: ["dairy-free"],
    leadTime: "Order 48h in advance",
    verified: false,
    emoji: "🍖",
    listingIds: ["listing-4"],
  },
  {
    id: "cook-4",
    displayName: "Fatima Al-Hassan",
    bio: "Levantine home cooking: shawarma plates, fattoush, musakhan, and the best hummus you'll have outside of Ramallah. Halal certified, always fresh, never frozen.",
    cuisineTypes: ["Middle Eastern"],
    initials: "FA",
    gradient: "linear-gradient(135deg, #b8712a 0%, #7a4510 100%)",
    rating: 5.0,
    reviewCount: 18,
    neighborhood: "Scarborough",
    city: "Toronto",
    badges: ["halal", "dairy-free"],
    leadTime: "Order 72h in advance",
    verified: true,
    emoji: "🧆",
    listingIds: ["listing-3"],
  },
  {
    id: "cook-5",
    displayName: "Nadia Romano",
    bio: "Northern Italian classics — risotto, osso buco, handmade pasta, and tiramisu. My nonna would approve. Sunday meal prep that actually transports you to Lombardy.",
    cuisineTypes: ["Italian"],
    initials: "NR",
    gradient: "linear-gradient(135deg, #9a4a28 0%, #5c2a0a 100%)",
    rating: 4.6,
    reviewCount: 14,
    neighborhood: "Little Italy",
    city: "Toronto",
    badges: [],
    leadTime: "Order 48h in advance",
    verified: false,
    emoji: "🍝",
    listingIds: ["listing-5"],
  },
];

// ─── Listings ──────────────────────────────────────────────────────────────────

export const MOCK_LISTINGS: MockListing[] = [
  {
    id: "listing-1",
    cookId: "cook-1",
    title: "West African Weekend Feast",
    description:
      "Choose from Jollof Rice, Egusi Stew, and Suya Skewers. Everything made fresh Friday morning for Saturday and Sunday pickup.",
    gradient: "linear-gradient(135deg, #c0392b 0%, #8e1a10 100%)",
    emoji: "🥘",
    pickupDate: "Sat Jun 7",
    pickupDateFull: "Saturday, June 7th",
    pickupWindow: "12pm – 5pm",
    orderDeadline: "Thu Jun 5, 11:59pm",
    orderDeadlineShort: "Thu Jun 5",
    maxOrders: 12,
    ordersLeft: 3,
    cuisineTypes: ["West African"],
    priceFrom: 18,
    dishes: [
      {
        id: "dish-1-1",
        name: "Jollof Rice (Party Style)",
        description:
          "Smoky, tomato-based rice with a signature crust. The real deal. Serves 2.",
        price: 18,
        portionSize: "Serves 2",
        emoji: "🍛",
        badges: ["halal", "gluten-free"],
      },
      {
        id: "dish-1-2",
        name: "Egusi Stew + Fufu",
        description:
          "Ground melon seed stew with pounded yam. Rich, hearty, and deeply satisfying.",
        price: 22,
        portionSize: "Serves 1–2",
        emoji: "🥘",
        badges: ["halal", "gluten-free"],
      },
      {
        id: "dish-1-3",
        name: "Suya Skewers (6 pcs)",
        description:
          "Spiced grilled beef skewers served with onions, tomatoes, and yaji powder.",
        price: 20,
        portionSize: "6 skewers",
        emoji: "🍢",
        badges: ["halal", "gluten-free"],
      },
    ],
  },
  {
    id: "listing-2",
    cookId: "cook-2",
    title: "Korean Banchan Box",
    description:
      "A curated set of house-made banchan: kimchi, spinach namul, japchae, and more. Perfect for 2–3 days of incredible side dishes.",
    gradient: "linear-gradient(135deg, #bf2026 0%, #6e0a0e 100%)",
    emoji: "🍱",
    pickupDate: "Fri Jun 6",
    pickupDateFull: "Friday, June 6th",
    pickupWindow: "5pm – 8pm",
    orderDeadline: "Wed Jun 4, 11:59pm",
    orderDeadlineShort: "Wed Jun 4",
    maxOrders: 15,
    ordersLeft: 8,
    cuisineTypes: ["Korean"],
    priceFrom: 16,
    dishes: [
      {
        id: "dish-2-1",
        name: "Banchan Box (5 sides)",
        description:
          "Kimchi, spinach namul, kongnamul, japchae, and gyeran-mari. Feeds 2 for 3 days.",
        price: 24,
        portionSize: "~1L total",
        emoji: "🍱",
        badges: ["gluten-free"],
      },
      {
        id: "dish-2-2",
        name: "Galbi (Short Ribs)",
        description:
          "Marinated and braised beef short ribs in a soy-sesame sauce. Fall-off-the-bone tender.",
        price: 32,
        portionSize: "Serves 2",
        emoji: "🥩",
        badges: [],
      },
      {
        id: "dish-2-3",
        name: "Doenjang Jjigae",
        description:
          "Fermented soybean paste stew with tofu, zucchini, and mushrooms. Pure comfort.",
        price: 16,
        portionSize: "Serves 2",
        emoji: "🫕",
        badges: ["vegetarian", "gluten-free"],
      },
    ],
  },
  {
    id: "listing-3",
    cookId: "cook-4",
    title: "Levantine Mezze Spread",
    description:
      "A full mezze experience: hummus, baba ganoush, fattoush, grape leaves, and your choice of protein. Halal certified.",
    gradient: "linear-gradient(135deg, #b8712a 0%, #7a4510 100%)",
    emoji: "🧆",
    pickupDate: "Sun Jun 8",
    pickupDateFull: "Sunday, June 8th",
    pickupWindow: "1pm – 4pm",
    orderDeadline: "Thu Jun 5, 8pm",
    orderDeadlineShort: "Thu Jun 5",
    maxOrders: 10,
    ordersLeft: 10,
    cuisineTypes: ["Middle Eastern"],
    priceFrom: 14,
    dishes: [
      {
        id: "dish-3-1",
        name: "Mezze Platter",
        description:
          "Hummus, baba ganoush, tabbouleh, and 4 warm pita breads. The perfect starter.",
        price: 16,
        portionSize: "Serves 2",
        emoji: "🫙",
        badges: ["halal", "vegetarian"],
      },
      {
        id: "dish-3-2",
        name: "Chicken Musakhan",
        description:
          "Sumac-spiced chicken on taboon bread with sweet caramelized onions and pine nuts.",
        price: 26,
        portionSize: "Serves 2",
        emoji: "🍗",
        badges: ["halal", "dairy-free"],
      },
      {
        id: "dish-3-3",
        name: "Stuffed Grape Leaves (12 pcs)",
        description:
          "Slow-cooked rice and herb stuffed grape leaves with a bright lemon sauce.",
        price: 14,
        portionSize: "12 pieces",
        emoji: "🥬",
        badges: ["halal", "vegan", "gluten-free"],
      },
    ],
  },
  {
    id: "listing-4",
    cookId: "cook-3",
    title: "Brazilian Saturday",
    description:
      "Authentic feijoada and sides, coxinha for snacking, and brigadeiros for dessert. A full taste of São Paulo.",
    gradient: "linear-gradient(135deg, #1a7a4a 0%, #0d4a2a 100%)",
    emoji: "🍖",
    pickupDate: "Sat Jun 7",
    pickupDateFull: "Saturday, June 7th",
    pickupWindow: "11am – 3pm",
    orderDeadline: "Wed Jun 4, 11:59pm",
    orderDeadlineShort: "Wed Jun 4",
    maxOrders: 8,
    ordersLeft: 5,
    cuisineTypes: ["Brazilian"],
    priceFrom: 14,
    dishes: [
      {
        id: "dish-4-1",
        name: "Feijoada",
        description:
          "The Brazilian national dish — black bean stew with pork and beef, served with rice and farofa.",
        price: 26,
        portionSize: "Serves 2",
        emoji: "🫘",
        badges: ["dairy-free", "gluten-free"],
      },
      {
        id: "dish-4-2",
        name: "Coxinha (6 pcs)",
        description:
          "Crispy chicken-filled dough balls. Golden, flaky, impossibly good.",
        price: 20,
        portionSize: "6 pieces",
        emoji: "🍗",
        badges: ["dairy-free"],
      },
      {
        id: "dish-4-3",
        name: "Brigadeiros (dozen)",
        description:
          "Classic Brazilian chocolate truffles, rolled in sprinkles.",
        price: 14,
        portionSize: "12 pieces",
        emoji: "🍫",
        badges: ["vegetarian"],
      },
    ],
  },
  {
    id: "listing-5",
    cookId: "cook-5",
    title: "Sunday Italian Meal Prep",
    description:
      "Northern Italian comfort food: handmade pasta, slow-cooked ragù, and tiramisu. Family recipes from Lombardy.",
    gradient: "linear-gradient(135deg, #9a4a28 0%, #5c2a0a 100%)",
    emoji: "🍝",
    pickupDate: "Sun Jun 8",
    pickupDateFull: "Sunday, June 8th",
    pickupWindow: "2pm – 6pm",
    orderDeadline: "Fri Jun 6, 11:59pm",
    orderDeadlineShort: "Fri Jun 6",
    maxOrders: 10,
    ordersLeft: 7,
    cuisineTypes: ["Italian"],
    priceFrom: 16,
    dishes: [
      {
        id: "dish-5-1",
        name: "Handmade Tagliatelle + Ragù",
        description:
          "Fresh egg pasta with a 6-hour slow-cooked meat sauce. Non-negotiably good.",
        price: 28,
        portionSize: "Serves 2",
        emoji: "🍝",
        badges: [],
      },
      {
        id: "dish-5-2",
        name: "Risotto Milanese",
        description:
          "Saffron-scented risotto with Parmigiano Reggiano. Rich, creamy, and deeply comforting.",
        price: 22,
        portionSize: "Serves 2",
        emoji: "🍚",
        badges: ["vegetarian"],
      },
      {
        id: "dish-5-3",
        name: "Tiramisu (2 portions)",
        description:
          "Classic tiramisu with savoiardi biscuits, mascarpone, and espresso. The real one.",
        price: 16,
        portionSize: "2 portions",
        emoji: "🍰",
        badges: ["vegetarian"],
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
    pickupDate: "Sat Jun 7",
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
    cookGradient: "linear-gradient(135deg, #c0392b 0%, #8e1a10 100%)",
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
    cookGradient: "linear-gradient(135deg, #bf2026 0%, #6e0a0e 100%)",
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
        "The jollof rice brought me right back home. Smoky, perfectly spiced, and the portions were generous. Will be ordering every week.",
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
        "Ji-won's banchan is unreal. I grew up eating Korean food and this tastes like what my mom makes. Blown away.",
      date: "May 25",
      orderedDish: "Banchan Box",
    },
    {
      id: "r5",
      clientName: "Tom W.",
      clientInitials: "TW",
      rating: 5,
      comment:
        "Galbi was perfectly tender. The galbi sauce was deep and complex. Easily the best home-cooked Korean food I've had in Toronto.",
      date: "May 18",
      orderedDish: "Galbi (Short Ribs)",
    },
  ],
};
