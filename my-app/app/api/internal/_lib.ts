import { createHash, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";

export function verifyInternalKey(provided: string): boolean {
  const expected = process.env.INTERNAL_API_KEY ?? "";
  // Hash both sides to normalize length before timing-safe comparison
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
  const apiKey = process.env.RESEND_API_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://7eats.ca";
  const link = `${baseUrl}/business-auth/setup/create-password?token=${rawToken}`;

  // Always log so the link is available in the terminal during testing
  console.log(`[issue-link] magic link for ${to}:\n${link}`);

  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@7eats.ca",
    to,
    subject: `${kitchenName} — complete your 7eats setup`,
    text: [
      "Hi,",
      "",
      "Your application has been approved. Use the link below to create your password and complete your setup.",
      "This link expires in 3 days.",
      "",
      link,
      "",
      "— The 7eats team",
    ].join("\n"),
  });

  if (error) throw new Error(error.message);
}
