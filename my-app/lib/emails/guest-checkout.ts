import { auth } from "@/lib/auth";

/**
 * Sends a "set your password" email to a newly created guest account.
 * Reuses Better Auth's password-reset email flow.
 * Fire-and-forget — never throws; logs failures instead.
 */
export async function sendGuestActivationEmail(email: string): Promise<void> {
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/app-auth/reset-password" },
    });
  } catch (err) {
    console.error("[guest-activation-email] failed to send:", err);
  }
}
