/**
 * Startup environment validation.
 *
 * Critical variables (payments, auth, DB, app URL) must be present in
 * production — `validateEnv()` throws if any are missing so the server fails
 * fast at boot instead of mid-request. Feature variables (email, SMS, maps,
 * uploads) only warn, since the app degrades gracefully without them.
 *
 * Wired into `instrumentation.ts` so it runs once when the server starts.
 */

const CRITICAL = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "COOKIE_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_CONNECT_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "MAPBOX_SECRET_TOKEN",
] as const;

// Present-but-degradable: the related feature silently no-ops without these.
const FEATURE: Record<string, string> = {
  RESEND_API_KEY: "transactional emails will not send",
  TWILIO_ACCOUNT_SID: "phone OTP / SMS will not send",
  TWILIO_AUTH_TOKEN: "phone OTP / SMS will not send",
  TWILIO_VERIFY_SERVICE_SID: "phone OTP / SMS will not send",
  TWILIO_MESSAGING_FROM_NUMBER: "order update texts will not send",
  R2_ACCOUNT_ID: "image uploads will fail",
  R2_ACCESS_KEY_ID: "image uploads will fail",
  R2_SECRET_ACCESS_KEY: "image uploads will fail",
  CRON_SECRET: "the payment reconciliation cron cannot be triggered",
};

let validated = false;

/**
 * Validates required environment variables. Call once at server startup.
 * Throws in production when any critical variable is missing or blank.
 */
export function validateEnv(): void {
  if (validated) return;
  validated = true;

  const isProd = process.env.NODE_ENV === "production";
  const missingCritical = CRITICAL.filter((key) => !process.env[key]?.trim());

  for (const [key, effect] of Object.entries(FEATURE)) {
    if (!process.env[key]?.trim()) {
      console.warn(`[env] ${key} is not set — ${effect}.`);
    }
  }

  if (missingCritical.length > 0) {
    const message = `[env] Missing required environment variable(s): ${missingCritical.join(
      ", ",
    )}`;
    if (isProd) {
      // Fail fast: a missing payment/auth/DB secret must never serve traffic.
      throw new Error(message);
    }
    console.warn(`${message} (allowed in non-production).`);
  } else {
    console.log("[env] Environment validation passed.");
  }
}
