export type NotificationKind = "order" | "review" | "cancelled";

export type MockNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  timestamp: string;
  href: string;
  isRead: boolean;
  rating?: number;
};

function ago(minutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

// Latest first. Order notifications point at the Orders page; review
// notifications point at the listing the review is about.
export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: "n-1",
    kind: "order",
    title: "New order",
    detail: "Amara Okafor · Weekend West African Feast",
    timestamp: ago(12),
    href: "/business/orders",
    isRead: false,
  },
  {
    id: "n-1b",
    kind: "cancelled",
    title: "Order cancelled",
    detail: "Marcus Reid · Lunch Bento Box",
    timestamp: ago(25),
    href: "/business/orders",
    isRead: false,
  },
  {
    id: "n-2",
    kind: "review",
    title: "New review",
    detail: "Liam Chen · Lunch Bento Box",
    timestamp: ago(60),
    href: "/business/listings/mock-listing-2",
    isRead: false,
    rating: 5,
  },
  {
    id: "n-3",
    kind: "order",
    title: "New order",
    detail: "Priya Nair · Evening Tikka Bowls",
    timestamp: ago(180),
    href: "/business/orders",
    isRead: false,
  },
  {
    id: "n-4",
    kind: "review",
    title: "New review",
    detail: "Sofia Russo · Falafel Wrap Combo",
    timestamp: ago(1440),
    href: "/business/listings/mock-listing-3",
    isRead: true,
    rating: 4,
  },
  {
    id: "n-5",
    kind: "order",
    title: "New order",
    detail: "Marcus Reid · Lunch Bento Box",
    timestamp: ago(1500),
    href: "/business/orders",
    isRead: true,
  },
  {
    id: "n-6",
    kind: "review",
    title: "New review",
    detail: "Kenji Tanaka · Weekend West African Feast",
    timestamp: ago(2880),
    href: "/business/listings/mock-listing-1",
    isRead: true,
    rating: 5,
  },
];
