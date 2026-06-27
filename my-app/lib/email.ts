import { Resend } from "resend";
import { type EmailSenderProfile, formatEmailFrom } from "@/lib/emails/base";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Inbox sender label. Default `noreply`; use `team` for human onboarding mail. */
  sender?: EmailSenderProfile;
}

/**
 * Sends a plain-text transactional email via Resend.
 *
 * When RESEND_API_KEY is unset (local dev) this is a no-op — callers are
 * expected to have already logged whatever link the email carries, so flows
 * stay testable from the terminal. Throws on a Resend API error so callers can
 * decide whether the failure is fatal.
 */
export async function sendMail({
  to,
  subject,
  text,
  html,
  sender = "noreply",
}: MailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: formatEmailFrom(sender),
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });

  if (error) throw new Error(error.message);
}
