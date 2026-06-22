import twilio from "twilio";
import { phoneToE164 } from "@/lib/phone";

function twilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

/** Send a transactional SMS. No-ops when Twilio or from-number is not configured. */
export async function sendSms(toPhone: string, body: string): Promise<void> {
  const from = process.env.TWILIO_MESSAGING_FROM_NUMBER?.trim();
  const client = twilioClient();
  const to = phoneToE164(toPhone);
  if (!client || !from || !to) return;

  try {
    await client.messages.create({ to, from, body });
  } catch (err) {
    console.error("[sms/send]", err);
  }
}
