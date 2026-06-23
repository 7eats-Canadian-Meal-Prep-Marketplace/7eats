import type { ClientNotificationPrefs } from "@/lib/client-notification-preferences";
import { normalizeClientNotificationPrefs } from "@/lib/client-notification-preferences";
import { sendSms } from "@/lib/sms";

export type OrderNotifyClient = {
  email: string;
  firstName: string | null;
  phone: string | null;
  phoneVerified: boolean;
  notificationPreferences: unknown;
};

export function orderUpdatePrefs(
  raw: unknown,
): Pick<ClientNotificationPrefs, "notifs" | "channels"> {
  const prefs = normalizeClientNotificationPrefs(raw);
  return { notifs: prefs.notifs, channels: prefs.channels };
}

export function shouldSendOrderUpdateEmail(client: OrderNotifyClient): boolean {
  if (!client.email) return false;
  if (client.notificationPreferences === undefined) return true;
  const { notifs, channels } = orderUpdatePrefs(client.notificationPreferences);
  return notifs.order_updates && channels.email;
}

export function shouldSendOrderUpdateSms(client: OrderNotifyClient): boolean {
  if (client.notificationPreferences === undefined) return false;
  const { notifs, channels } = orderUpdatePrefs(client.notificationPreferences);
  return (
    notifs.order_updates &&
    channels.sms &&
    client.phoneVerified &&
    Boolean(client.phone)
  );
}

export async function sendOrderUpdateSms(
  client: OrderNotifyClient,
  body: string,
): Promise<void> {
  if (!shouldSendOrderUpdateSms(client) || !client.phone) return;
  await sendSms(client.phone, body);
}

export async function deliverOrderClientUpdate(
  client: OrderNotifyClient,
  sendEmail: () => Promise<void>,
  smsBody: string,
): Promise<void> {
  const wantsEmail = shouldSendOrderUpdateEmail(client);
  const wantsSms = shouldSendOrderUpdateSms(client);
  if (!wantsEmail && !wantsSms) return;
  if (wantsEmail) await sendEmail();
  if (wantsSms) await sendOrderUpdateSms(client, smsBody);
}
