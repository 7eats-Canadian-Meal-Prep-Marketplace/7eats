import { createHash, timingSafeEqual } from "node:crypto";
import { sendMail } from "@/lib/email";
import {
  contactParagraph,
  contactTextLine,
  htmlEmail,
  paragraph,
} from "@/lib/emails/base";

export function verifyInternalKey(provided: string): boolean {
  const expected = process.env.INTERNAL_API_KEY ?? "";
  if (!expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function sendSetupEmail(
  to: string,
  kitchenName: string,
  rawToken: string,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://7eats.ca";
  const link = `${baseUrl}/business-auth/setup/create-password?token=${rawToken}`;

  if (process.env.NODE_ENV !== "production") {
    console.log(`[issue-link] magic link for ${to}:\n${link}`);
  } else {
    console.log(`[issue-link] sending setup link to ${to}`);
  }

  await sendMail({
    to,
    subject: `${kitchenName} - complete your 7eats setup`,
    text: [
      "Hi,",
      "",
      "Your application has been approved. Use the link below to create your password and complete your setup.",
      "This link expires in 3 days.",
      "",
      link,
      "",
      contactTextLine(),
      "",
      "The 7eats team",
    ].join("\n"),
    html: htmlEmail({
      title: "Complete your 7eats setup",
      preheader:
        "Your application was approved. Set your password to continue.",
      bodyHtml:
        paragraph("Hi,") +
        paragraph(
          "Your application has been approved. Use the button below to create your password and complete your setup.",
        ) +
        paragraph("This link expires in 3 days.") +
        contactParagraph(),
      ctaLabel: "Complete setup",
      ctaUrl: link,
    }),
  });
}
