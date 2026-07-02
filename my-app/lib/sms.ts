import twilio from "twilio";
import { phoneToE164 } from "@/lib/phone";

function twilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

/** Send a transactional SMS via Twilio Messaging (not Verify). */
export async function sendSms(toPhone: string, body: string): Promise<void> {
  const from = process.env.TWILIO_MESSAGING_FROM_NUMBER?.trim();
  const client = twilioClient();
  const to = phoneToE164(toPhone);
  if (!client) {
    console.warn(
      "[sms/send] skipped — TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing",
    );
    return;
  }
  if (!from) {
    console.warn("[sms/send] skipped — TWILIO_MESSAGING_FROM_NUMBER missing");
    return;
  }
  if (!to) {
    console.warn("[sms/send] skipped — invalid destination phone");
    return;
  }

  try {
    await client.messages.create({ to, from, body });
  } catch (err) {
    console.error("[sms/send]", err);
  }
}
