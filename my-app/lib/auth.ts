import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "@/db/schema/auth";
import { sendMail } from "@/lib/email";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Sign-up never starts a session. Cooks sign in explicitly via
    // create-account; clients must confirm their email first (see below).
    autoSignIn: false,
  },
  emailVerification: {
    expiresIn: 60 * 60 * 24, // 24 hours
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      // Log so the link is testable from the terminal when RESEND_API_KEY is
      // unset, mirroring the cook setup-email behavior.
      console.log(
        `[verify-email] confirmation link for ${user.email}:\n${url}`,
      );
      await sendMail({
        to: user.email,
        subject: "Confirm your email — 7eats",
        text: [
          "Welcome to 7eats!",
          "",
          "Confirm your email address to activate your account:",
          url,
          "",
          "This link expires in 24 hours.",
          "",
          "— The 7eats team",
        ].join("\n"),
      });
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "cook", required: false },
      status: { type: "string", defaultValue: "active", required: false },
      firstName: { type: "string", required: false },
      lastName: { type: "string", required: false },
      phone: { type: "string", required: false },
      phoneVerified: { type: "boolean", defaultValue: false, required: false },
    },
  },
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (() => {
      throw new Error("BETTER_AUTH_SECRET is not set");
    })(),
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});
