export type SlotStatus = "open" | "full" | "closed";

export type MockSlotOrder = {
  id: string;
  customerName: string;
  quantity: number;
};

export type MockSlot = {
  id: string;
  date: string;
  listingTitle: string;
  count: number;
  status: SlotStatus;
  orders: MockSlotOrder[];
};

// Monday (00:00 local) of the week containing today.
export function currentWeekStart(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function slotDate(dayOffset: number, hour: number, minute = 0): string {
  const d = currentWeekStart();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const MOCK_SLOTS: MockSlot[] = [
  {
    id: "s-1",
    date: slotDate(0, 12, 0),
    listingTitle: "Weekend West African Feast",
    count: 3,
    status: "open",
    orders: [
      { id: "o-1", customerName: "Amara Okafor", quantity: 1 },
      { id: "o-2", customerName: "Liam Chen", quantity: 1 },
      { id: "o-3", customerName: "Priya Nair", quantity: 1 },
    ],
  },
  {
    id: "s-2",
    date: slotDate(1, 11, 30),
    listingTitle: "Lunch Bento Box",
    count: 5,
    status: "full",
    orders: [
      { id: "o-4", customerName: "Marcus Reid", quantity: 2 },
      { id: "o-5", customerName: "Sofia Russo", quantity: 1 },
      { id: "o-6", customerName: "Kenji Tanaka", quantity: 1 },
      { id: "o-7", customerName: "Dana White", quantity: 1 },
    ],
  },
  {
    id: "s-3",
    date: slotDate(1, 17, 30),
    listingTitle: "Evening Tikka Bowls",
    count: 2,
    status: "open",
    orders: [
      { id: "o-8", customerName: "Hassan Ali", quantity: 1 },
      { id: "o-9", customerName: "Grace Lin", quantity: 1 },
    ],
  },
  {
    id: "s-4",
    date: slotDate(2, 12, 0),
    listingTitle: "Falafel Wrap Combo",
    count: 4,
    status: "open",
    orders: [
      { id: "o-10", customerName: "Noah Park", quantity: 2 },
      { id: "o-11", customerName: "Aisha Khan", quantity: 1 },
      { id: "o-12", customerName: "Theo Martin", quantity: 1 },
    ],
  },
  {
    id: "s-5",
    date: slotDate(3, 11, 0),
    listingTitle: "Lunch Bento Box",
    count: 6,
    status: "full",
    orders: [
      { id: "o-13", customerName: "Emily Zhou", quantity: 2 },
      { id: "o-14", customerName: "Omar Said", quantity: 2 },
      { id: "o-15", customerName: "Lena Vogel", quantity: 1 },
      { id: "o-16", customerName: "Caleb Moore", quantity: 1 },
    ],
  },
  {
    id: "s-6",
    date: slotDate(3, 18, 0),
    listingTitle: "Miso Salmon Dinner",
    count: 0,
    status: "closed",
    orders: [],
  },
  {
    id: "s-7",
    date: slotDate(4, 12, 30),
    listingTitle: "Weekend West African Feast",
    count: 4,
    status: "open",
    orders: [
      { id: "o-17", customerName: "Ruby Singh", quantity: 1 },
      { id: "o-18", customerName: "Jonas Berg", quantity: 2 },
      { id: "o-19", customerName: "Maya Cohen", quantity: 1 },
    ],
  },
  {
    id: "s-8",
    date: slotDate(4, 17, 0),
    listingTitle: "Evening Tikka Bowls",
    count: 3,
    status: "open",
    orders: [
      { id: "o-20", customerName: "Felix Wong", quantity: 1 },
      { id: "o-21", customerName: "Isla Murphy", quantity: 1 },
      { id: "o-22", customerName: "Diego Cruz", quantity: 1 },
    ],
  },
  {
    id: "s-9",
    date: slotDate(5, 13, 0),
    listingTitle: "Brunch Flatbread Set",
    count: 5,
    status: "full",
    orders: [
      { id: "o-23", customerName: "Hana Yoshida", quantity: 2 },
      { id: "o-24", customerName: "Owen Clarke", quantity: 1 },
      { id: "o-25", customerName: "Nadia Haddad", quantity: 2 },
    ],
  },
  {
    id: "s-10",
    date: slotDate(6, 12, 0),
    listingTitle: "Sunday Suya Platter",
    count: 2,
    status: "open",
    orders: [
      { id: "o-26", customerName: "Eli Foster", quantity: 1 },
      { id: "o-27", customerName: "Zoe Adams", quantity: 1 },
    ],
  },
];
