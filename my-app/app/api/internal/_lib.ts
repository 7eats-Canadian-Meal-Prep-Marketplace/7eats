import { createHash, timingSafeEqual } from "node:crypto";
import { sendMail } from "@/lib/email";
import { htmlEmail, paragraph } from "@/lib/emails/base";

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
    console.error(`[issue-link] magic link for ${to}:\n${link}`);
  } else {
    console.error(`[issue-link] sending setup link to ${to}`);
  }

  const subject = `Complete your 7eats setup, ${kitchenName}`;
  const html = htmlEmail({
    title: subject,
    preheader:
      "Your application has been approved. Finish setting up your kitchen.",
    bodyHtml:
      paragraph("Hi,") +
      paragraph(
        "Your application has been approved. Click below to create your password and complete your kitchen setup. The link expires in 3 days.",
      ),
    ctaLabel: "Complete setup",
    ctaUrl: link,
  });

  await sendMail({
    to,
    subject,
    text: [
      "Hi,",
      "",
      "Your application has been approved. Use the link below to create your password and complete your kitchen setup.",
      "This link expires in 3 days.",
      "",
      link,
      "",
      "The 7eats team",
    ].join("\n"),
    html,
  });
}
