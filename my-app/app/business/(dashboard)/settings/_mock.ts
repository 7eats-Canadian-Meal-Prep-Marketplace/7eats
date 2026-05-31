export type MockKitchen = {
  kitchenName: string;
  kitchenType: string;
  yearsOperating: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  website: string;
  businessPhone: string;
  businessEmail: string;
  bio: string;
};

export const MOCK_KITCHEN: MockKitchen = {
  kitchenName: "Amara's Kitchen",
  kitchenType: "licensed_home",
  yearsOperating: "3-5 years",
  street: "248 Roncesvalles Ave",
  city: "Toronto",
  province: "ON",
  postalCode: "M6R 2M1",
  website: "amaraskitchen.ca",
  businessPhone: "+1 (416) 555-0182",
  businessEmail: "hello@amaraskitchen.ca",
  bio: "Bringing the rich, bold flavours of West Africa to Toronto — one home-cooked meal at a time.",
};

export type MockAccount = {
  firstName: string;
  lastName: string;
  role: string;
  personalPhone: string;
  loginEmail: string;
};

export const MOCK_ACCOUNT: MockAccount = {
  firstName: "Amara",
  lastName: "Diallo",
  role: "Owner",
  personalPhone: "+1 (416) 555-0182",
  loginEmail: "amara@amaraskitchen.ca",
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
    description:
      "A once-a-day recap of orders, revenue, and upcoming pickup days.",
    enabled: false,
  },
  {
    id: "messages",
    label: "Messages",
    description: "Get notified when a customer sends you a message.",
    enabled: true,
  },
  {
    id: "marketing_emails",
    label: "Marketing emails",
    description: "Tips, product updates, and the occasional offer.",
    enabled: false,
  },
];

export type MockChannels = {
  email: boolean;
  sms: boolean;
};

export const MOCK_CHANNELS: MockChannels = {
  email: true,
  sms: false,
};

export type StripeStatus = "connected" | "pending" | "not_connected";

export type MockStripeAccount = {
  status: StripeStatus;
  institution: string;
  last4: string;
  schedule: "weekly" | "biweekly" | "monthly";
};

export const MOCK_STRIPE_ACCOUNT: MockStripeAccount = {
  status: "connected",
  institution: "Royal Bank of Canada",
  last4: "4821",
  schedule: "weekly",
};
