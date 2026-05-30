export type MockProfile = {
  businessName: string;
  contactEmail: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
};

export const MOCK_PROFILE: MockProfile = {
  businessName: "Amara's Kitchen",
  contactEmail: "hello@amaraskitchen.ca",
  phone: "+1 (416) 555-0182",
  street: "248 Roncesvalles Ave",
  city: "Toronto",
  province: "ON",
  postalCode: "M6R 2M1",
};

export type MockNotification = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: "new_orders",
    label: "New orders",
    description: "Get notified the moment a customer places an order.",
    enabled: true,
  },
  {
    id: "order_cancelled",
    label: "Order cancelled",
    description: "Know when a customer cancels a confirmed order.",
    enabled: true,
  },
  {
    id: "daily_summary",
    label: "Daily summary",
    description: "A once-a-day recap of orders, revenue, and pickups.",
    enabled: false,
  },
  {
    id: "marketing_emails",
    label: "Marketing emails",
    description: "Tips, product updates, and the occasional offer.",
    enabled: false,
  },
];

export type PayoutSchedule = "weekly" | "biweekly" | "monthly";

export type MockPayoutSettings = {
  bankLast4: string;
  institution: string;
  schedule: PayoutSchedule;
  minThreshold: string;
};

export const MOCK_PAYOUT_SETTINGS: MockPayoutSettings = {
  bankLast4: "4821",
  institution: "Royal Bank of Canada",
  schedule: "weekly",
  minThreshold: "50",
};
