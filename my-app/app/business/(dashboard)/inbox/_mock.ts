// Conversations only exist for customers with an active (non-cancelled) order
// with this cook. Each conversation is tied to a real order so the thread can
// link straight to it. Order ids/customers mirror the Orders mock.

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "ready"
  | "fulfilled"
  | "cancelled";

export type ChatMessage = {
  id: string;
  from: "customer" | "cook";
  body: string;
  timestamp: string;
};

export type ConversationOrder = {
  id: string;
  listingTitle: string;
  quantity: number;
  totalPrice: string;
  pickupAt: string;
  status: OrderStatus;
};

export type MockConversation = {
  id: string;
  customerName: string;
  order: ConversationOrder;
  messages: ChatMessage[];
  unread: boolean;
};

function ago(days: number, hours = 0, minutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours, d.getMinutes() - minutes, 0, 0);
  return d.toISOString();
}

function inHours(h: number): string {
  return new Date(Date.now() + h * 3_600_000).toISOString();
}

export const MOCK_CONVERSATIONS: MockConversation[] = [
  {
    id: "c-1",
    customerName: "Amara Diallo",
    order: {
      id: "ord-1",
      listingTitle: "West African Comfort Box",
      quantity: 2,
      totalPrice: "54.00",
      pickupAt: inHours(1.5),
      status: "pending",
    },
    unread: true,
    messages: [
      {
        id: "c1-1",
        from: "customer",
        body: "Hi! Just placed an order for two Comfort Boxes 🙌 is it possible to do no pepper on one of them?",
        timestamp: ago(0, 0, 38),
      },
      {
        id: "c1-2",
        from: "cook",
        body: "Hey Amara! Absolutely, I'll make one mild with no pepper. Thanks for letting me know.",
        timestamp: ago(0, 0, 31),
      },
      {
        id: "c1-3",
        from: "customer",
        body: "Perfect, thank you so much. See you at pickup!",
        timestamp: ago(0, 0, 12),
      },
    ],
  },
  {
    id: "c-2",
    customerName: "Lena Schmidt",
    order: {
      id: "ord-2",
      listingTitle: "Sunday Jollof Special",
      quantity: 1,
      totalPrice: "27.00",
      pickupAt: inHours(3),
      status: "pending",
    },
    unread: true,
    messages: [
      {
        id: "c2-1",
        from: "customer",
        body: "Hi, I might be about 10 minutes late for pickup — is that okay?",
        timestamp: ago(0, 1, 5),
      },
    ],
  },
  {
    id: "c-3",
    customerName: "Marcus Osei",
    order: {
      id: "ord-3",
      listingTitle: "West African Comfort Box",
      quantity: 3,
      totalPrice: "81.00",
      pickupAt: inHours(0.5),
      status: "ready",
    },
    unread: false,
    messages: [
      {
        id: "c3-1",
        from: "customer",
        body: "Is my order ready? On my way now.",
        timestamp: ago(0, 2),
      },
      {
        id: "c3-2",
        from: "cook",
        body: "All packed and ready for you, Marcus. I'll be at the door.",
        timestamp: ago(0, 1, 50),
      },
    ],
  },
  {
    id: "c-4",
    customerName: "Priya Nair",
    order: {
      id: "ord-4",
      listingTitle: "Kelewele Snack Pack",
      quantity: 2,
      totalPrice: "30.00",
      pickupAt: inHours(5),
      status: "confirmed",
    },
    unread: false,
    messages: [
      {
        id: "c4-1",
        from: "customer",
        body: "Are the Kelewele packs nut-free? Checking for my daughter.",
        timestamp: ago(1, 3),
      },
      {
        id: "c4-2",
        from: "cook",
        body: "They're nut-free, yes — fried in vegetable oil, no peanuts in the kitchen that day. 👍",
        timestamp: ago(1, 2, 40),
      },
      {
        id: "c4-3",
        from: "customer",
        body: "Amazing, thank you!",
        timestamp: ago(1, 2, 30),
      },
    ],
  },
  {
    id: "c-5",
    customerName: "Fatou Camara",
    order: {
      id: "ord-9",
      listingTitle: "Kelewele Snack Pack",
      quantity: 4,
      totalPrice: "60.00",
      pickupAt: inHours(2),
      status: "pending",
    },
    unread: false,
    messages: [
      {
        id: "c5-1",
        from: "customer",
        body: "Picking up for the whole office — could you split it into two bags if it's easy? No worries if not!",
        timestamp: ago(2, 4),
      },
      {
        id: "c5-2",
        from: "cook",
        body: "Easy! I'll do two bags of two. See you then.",
        timestamp: ago(2, 3, 55),
      },
    ],
  },
  {
    id: "c-6",
    customerName: "Tom Eriksson",
    order: {
      id: "ord-5",
      listingTitle: "Sunday Jollof Special",
      quantity: 1,
      totalPrice: "27.00",
      pickupAt: inHours(26),
      status: "confirmed",
    },
    unread: true,
    messages: [
      {
        id: "c6-1",
        from: "customer",
        body: "Could I get extra sauce on the side if possible?",
        timestamp: ago(0, 3),
      },
    ],
  },
  {
    id: "c-7",
    customerName: "Nadia Okonkwo",
    order: {
      id: "ord-10",
      listingTitle: "West African Comfort Box",
      quantity: 2,
      totalPrice: "54.00",
      pickupAt: inHours(6),
      status: "confirmed",
    },
    unread: false,
    messages: [
      {
        id: "c7-1",
        from: "customer",
        body: "Hi! What time should I aim for to avoid the rush?",
        timestamp: ago(0, 7),
      },
      {
        id: "c7-2",
        from: "cook",
        body: "Anytime after 6:30 is usually quiet. Whatever works for you!",
        timestamp: ago(0, 6, 45),
      },
    ],
  },
  {
    id: "c-8",
    customerName: "Isabelle Mouton",
    order: {
      id: "ord-6",
      listingTitle: "Sunday Jollof Special",
      quantity: 1,
      totalPrice: "27.00",
      pickupAt: ago(1),
      status: "fulfilled",
    },
    unread: false,
    messages: [
      {
        id: "c8-1",
        from: "customer",
        body: "Just had the jollof — honestly the best I've had in the city. Thank you!",
        timestamp: ago(1, 1),
      },
      {
        id: "c8-2",
        from: "cook",
        body: "That means a lot, Isabelle 🙏 hope to cook for you again soon!",
        timestamp: ago(1, 0, 50),
      },
    ],
  },
  {
    id: "c-9",
    customerName: "Kofi Adu",
    order: {
      id: "ord-7",
      listingTitle: "West African Comfort Box",
      quantity: 1,
      totalPrice: "27.00",
      pickupAt: ago(2),
      status: "fulfilled",
    },
    unread: false,
    messages: [
      {
        id: "c9-1",
        from: "customer",
        body: "Picked up, thanks! Quick q — was there shrimp in the stew?",
        timestamp: ago(2, 1),
      },
      {
        id: "c9-2",
        from: "cook",
        body: "No shrimp — it's chicken and beef only. Let me know if you need a full allergen list anytime.",
        timestamp: ago(2, 0, 40),
      },
      {
        id: "c9-3",
        from: "customer",
        body: "Perfect, appreciate it 👍",
        timestamp: ago(2, 0, 35),
      },
    ],
  },
  {
    id: "c-10",
    customerName: "Yaw Mensah",
    order: {
      id: "ord-11",
      listingTitle: "Sunday Jollof Special",
      quantity: 2,
      totalPrice: "54.00",
      pickupAt: ago(3),
      status: "fulfilled",
    },
    unread: false,
    messages: [
      {
        id: "c10-1",
        from: "customer",
        body: "Do you take orders for next weekend yet?",
        timestamp: ago(3, 2),
      },
      {
        id: "c10-2",
        from: "cook",
        body: "Menu drops Wednesday — I'll have the jollof and a new suya platter. Watch the listings page!",
        timestamp: ago(3, 1, 30),
      },
    ],
  },
  {
    id: "c-11",
    customerName: "Hassan Ali",
    order: {
      id: "ord-12",
      listingTitle: "West African Comfort Box",
      quantity: 3,
      totalPrice: "81.00",
      pickupAt: inHours(20),
      status: "confirmed",
    },
    unread: true,
    messages: [
      {
        id: "c11-1",
        from: "customer",
        body: "Hey! Big order this time — having a few friends over.",
        timestamp: ago(0, 9),
      },
      {
        id: "c11-2",
        from: "cook",
        body: "Love it! Three boxes coming up. Any spice preferences across them?",
        timestamp: ago(0, 8, 50),
      },
      {
        id: "c11-3",
        from: "customer",
        body: "Two regular, one mild please.",
        timestamp: ago(0, 8, 45),
      },
      {
        id: "c11-4",
        from: "cook",
        body: "Got it. Two regular, one mild.",
        timestamp: ago(0, 8, 44),
      },
      {
        id: "c11-5",
        from: "customer",
        body: "Also — is the plantain ripe-sweet or savoury?",
        timestamp: ago(0, 8, 30),
      },
      {
        id: "c11-6",
        from: "cook",
        body: "Sweet and caramelised, the way I like it 😄",
        timestamp: ago(0, 8, 28),
      },
      {
        id: "c11-7",
        from: "customer",
        body: "Perfect. Can we do pickup a little later, like 7:45?",
        timestamp: ago(0, 7),
      },
      {
        id: "c11-8",
        from: "cook",
        body: "7:45 works. I'll keep them warm for you.",
        timestamp: ago(0, 6, 55),
      },
      {
        id: "c11-9",
        from: "customer",
        body: "You're the best. One more — do you have any vegetarian sides I can add?",
        timestamp: ago(0, 5),
      },
      {
        id: "c11-10",
        from: "cook",
        body: "I've got extra plantain and a veggie jollof side. Want me to throw a couple in?",
        timestamp: ago(0, 4, 50),
      },
      {
        id: "c11-11",
        from: "customer",
        body: "Yes please, two veggie jollof sides.",
        timestamp: ago(0, 4, 30),
      },
      {
        id: "c11-12",
        from: "cook",
        body: "Done — I'll add them and update your total at pickup. See you at 7:45!",
        timestamp: ago(0, 1),
      },
    ],
  },
  {
    id: "c-12",
    customerName: "Grace Lin",
    order: {
      id: "ord-13",
      listingTitle: "Kelewele Snack Pack",
      quantity: 1,
      totalPrice: "15.00",
      pickupAt: inHours(4),
      status: "pending",
    },
    unread: false,
    messages: [
      {
        id: "c12-1",
        from: "customer",
        body: "First time ordering — so excited to try the kelewele!",
        timestamp: ago(1, 5),
      },
      {
        id: "c12-2",
        from: "cook",
        body: "Welcome, Grace! You're going to love it. See you at pickup 😊",
        timestamp: ago(1, 4, 50),
      },
    ],
  },
  {
    id: "c-13",
    customerName: "Diego Cruz",
    order: {
      id: "ord-14",
      listingTitle: "Sunday Jollof Special",
      quantity: 2,
      totalPrice: "54.00",
      pickupAt: inHours(28),
      status: "confirmed",
    },
    unread: false,
    messages: [
      {
        id: "c13-1",
        from: "customer",
        body: "Can I pay the difference if I add a third box later?",
        timestamp: ago(2, 6),
      },
      {
        id: "c13-2",
        from: "cook",
        body: "Of course — just message me before tomorrow noon and I'll adjust it.",
        timestamp: ago(2, 5, 40),
      },
    ],
  },
  {
    id: "c-14",
    customerName: "Sofia Russo",
    order: {
      id: "ord-15",
      listingTitle: "West African Comfort Box",
      quantity: 1,
      totalPrice: "27.00",
      pickupAt: inHours(1),
      status: "ready",
    },
    unread: true,
    messages: [
      {
        id: "c14-1",
        from: "customer",
        body: "Outside in a grey Honda whenever it's ready 🚗",
        timestamp: ago(0, 0, 8),
      },
    ],
  },
  {
    id: "c-15",
    customerName: "Noah Park",
    order: {
      id: "ord-16",
      listingTitle: "Kelewele Snack Pack",
      quantity: 2,
      totalPrice: "30.00",
      pickupAt: inHours(7),
      status: "pending",
    },
    unread: false,
    messages: [
      {
        id: "c15-1",
        from: "customer",
        body: "Are these good reheated the next day?",
        timestamp: ago(1, 8),
      },
      {
        id: "c15-2",
        from: "cook",
        body: "Best fresh, but a quick pan-fry the next day brings them right back.",
        timestamp: ago(1, 7, 45),
      },
    ],
  },
];
