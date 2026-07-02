import { sendMail } from "@/lib/email";
import { htmlEmail, paragraph, pickupCodeBlock } from "./base";

/**
 * Emails a guest their 6-digit checkout verification code. Throws on a delivery
 * error so the caller can surface a failure. In non-production the code is also
 * logged, so the flow stays testable when Resend isn't configured (sendMail is a
 * no-op without an API key).
 */
export async function sendGuestEmailOtp(
  email: string,
  code: string,
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[guest-email-otp] verification code for ${email}: ${code}`);
  }

  const subject = `Your 7eats verification code: ${code}`;
  const html = htmlEmail({
    title: subject,
    preheader: `Your verification code is ${code}.`,
    bodyHtml:
      paragraph(
        "Enter this code on the checkout page to confirm your email and place your order:",
      ) +
      pickupCodeBlock(code, "Verification code") +
      paragraph(
        "This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.",
      ),
  });
  const text = [
    "Enter this code on the checkout page to confirm your email and place your order:",
    "",
    code,
    "",
    "This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.",
  ].join("\n");

  await sendMail({ to: email, subject, text, html });
}
