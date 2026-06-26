import { sendSms } from "@/lib/sms";

export type CookNewOrderNotify = {
  phone: string | null;
  phoneVerified: boolean;
  smsNotificationsNewOrder: boolean;
};

export function shouldSendCookNewOrderSms(cook: CookNewOrderNotify): boolean {
  return (
    cook.smsNotificationsNewOrder && cook.phoneVerified && Boolean(cook.phone)
  );
}

export function formatCookNewOrderSmsBody(
  customerName: string,
  listingTitle: string,
): string {
  const title =
    listingTitle.length > 40 ? `${listingTitle.slice(0, 37)}...` : listingTitle;
  return `7eats: New order from ${customerName}: ${title}. Review in your dashboard.`;
}

export async function sendCookNewOrderSms(
  cook: CookNewOrderNotify,
  customerName: string,
  listingTitle: string,
): Promise<void> {
  if (!shouldSendCookNewOrderSms(cook) || !cook.phone) return;
  await sendSms(
    cook.phone,
    formatCookNewOrderSmsBody(customerName, listingTitle),
  );
}
