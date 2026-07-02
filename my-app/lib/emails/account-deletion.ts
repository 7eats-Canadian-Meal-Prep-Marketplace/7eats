import { sendMail } from "@/lib/email";
import { CONTACT_EMAIL } from "@/lib/emails/base";

const FONT_STACK =
  "'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function accountDeletedEmailContent(firstName: string | null): {
  subject: string;
  text: string;
  html: string;
} {
  const name = firstName?.trim();
  const greeting = name ? `Hi ${name},` : "Hi,";

  const subject = "Your 7eats account has been deleted";

  const text = [
    greeting,
    "",
    "This confirms your 7eats customer account has been deleted.",
    "The deletion is permanent. There is no grace period and we cannot restore your account.",
    "",
    "Your profile, saved cards, and preferences are gone. Past orders stay on file for payment records, but your name and contact details have been removed.",
    "",
    "You can sign up again with the same email or phone number whenever you like.",
    "",
    `If you did not request this, contact us immediately at ${CONTACT_EMAIL}.`,
    "",
    "The 7eats team",
  ].join("\n");

  const bodyCopy = [
    "This confirms your 7eats customer account has been deleted.",
    "The deletion is <strong>permanent</strong>. There is no grace period and we cannot restore your account.",
    "Your profile, saved cards, and preferences are gone. Past orders stay on file for payment records, but your name and contact details have been removed.",
    "You can sign up again with the same email or phone number whenever you like.",
    `If you did not request this, contact us immediately at <a href="mailto:${CONTACT_EMAIL}" style="color:#d64045;font-weight:600;text-decoration:none;">${CONTACT_EMAIL}</a>.`,
  ]
    .map(
      (copy) =>
        `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:#0f0f0f;">${copy}</p>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
<tr>
<td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;">
<tr>
<td style="padding:0 0 28px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:#0f0f0f;">
<h1 style="margin:0 0 22px;font-family:${FONT_STACK};font-size:26px;font-weight:700;letter-spacing:-0.025em;line-height:1.15;color:#0f0f0f;">Your account has been deleted</h1>
<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:#0f0f0f;">${escapeHtml(greeting)}</p>
${bodyCopy}
</td>
</tr>
<tr>
<td style="padding:28px 0 0;border-top:1px solid #ececec;font-family:${FONT_STACK};font-size:12.5px;line-height:1.6;color:#6b6b6b;">
&copy; 7eats &middot; Toronto
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}

/** Fire-and-forget after deletion; logs failures but does not throw. */
export async function sendAccountDeletedEmail(
  to: string,
  firstName: string | null,
): Promise<void> {
  if (!to.includes("@") || to.includes("@deleted.7eats.internal")) return;

  const { subject, text, html } = accountDeletedEmailContent(firstName);
  try {
    await sendMail({ to, subject, text, html });
  } catch (err) {
    console.error("[account-deletion-email]", err);
  }
}
