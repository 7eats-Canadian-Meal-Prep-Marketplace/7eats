export type MessageType = "order_update" | "support" | "system";

export type MockMessage = {
  id: string;
  senderName: string;
  subject: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  type: MessageType;
};

function ago(days: number, hours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

export const MOCK_MESSAGES: MockMessage[] = [
  {
    id: "m-1",
    senderName: "7eats Orders",
    subject: "New order for Weekend West African Feast",
    body: "You have a new order from Amara Okafor for the Weekend West African Feast, pickup scheduled for Friday at 12:30 PM. The order total is $48 for 1 serving. Confirm the order from your Orders tab to lock in the pickup slot.",
    timestamp: ago(0, 2),
    isRead: false,
    type: "order_update",
  },
  {
    id: "m-2",
    senderName: "Customer Support",
    subject: "Re: Question about payout timing",
    body: "Thanks for reaching out. Payouts are processed every Friday for orders fulfilled in the prior week, and typically land in your bank account within 1–2 business days. If you don't see a payout you're expecting, reply here and we'll look into it for you.",
    timestamp: ago(0, 5),
    isRead: false,
    type: "support",
  },
  {
    id: "m-3",
    senderName: "7eats",
    subject: "Your weekly summary is ready",
    body: "Last week you fulfilled 18 orders across 4 listings, earning $3,980 in revenue — up 15% from the week before. Your top listing was the Lunch Bento Box. Open your Earnings tab for the full breakdown.",
    timestamp: ago(1),
    isRead: true,
    type: "system",
  },
  {
    id: "m-4",
    senderName: "7eats Orders",
    subject: "Order cancelled by customer",
    body: "Marcus Reid cancelled their order for the Miso Salmon Dinner scheduled for Thursday at 6:00 PM. No action is needed — the slot has been released and no payout was affected.",
    timestamp: ago(2),
    isRead: true,
    type: "order_update",
  },
  {
    id: "m-5",
    senderName: "Customer Support",
    subject: "We've updated our pickup guidelines",
    body: "We've refreshed our pickup guidelines to make handoffs smoother for both you and your customers. The key change: customers now receive a 6-digit pickup code that you verify in the Orders tab before marking an order complete. Nothing else changes on your end.",
    timestamp: ago(3),
    isRead: true,
    type: "support",
  },
  {
    id: "m-6",
    senderName: "7eats",
    subject: "Action needed: verify your bank details",
    body: "To keep your payouts running smoothly, please confirm your bank account details in Settings → Payout. Accounts with unverified details may experience a short delay on their next payout.",
    timestamp: ago(4),
    isRead: false,
    type: "system",
  },
  {
    id: "m-7",
    senderName: "7eats Orders",
    subject: "Order marked complete",
    body: "Your order for Priya Nair (Evening Tikka Bowls) was marked complete on pickup. $32 has been added to your next payout. Nice work!",
    timestamp: ago(6),
    isRead: true,
    type: "order_update",
  },
];
