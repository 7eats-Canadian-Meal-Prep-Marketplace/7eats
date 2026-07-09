import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "@/db/schema/auth";
import { authSecondaryStorage } from "@/lib/auth-secondary-storage";
import { sendMail } from "@/lib/email";
import {
  contactParagraph,
  contactTextLine,
  htmlEmail,
  paragraph,
} from "@/lib/emails/base";

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
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // `url` is the full reset link already including the token and the
      // redirectTo we passed in requestPasswordReset — use it directly so both
      // client (/app-auth/reset-password) and business (/business-auth/reset-password)
      // resets land on the right page.
      if (process.env.NODE_ENV !== "production") {
        console.log(`[reset-password] reset link for ${user.email}:\n${url}`);
      }
      await sendMail({
        to: user.email,
        subject: "Reset your 7eats password",
        text: [
          "Hi,",
          "",
          "We received a request to reset your 7eats password.",
          "Use the link below to set a new one. It expires in 1 hour.",
          "",
          url,
          "",
          "If you didn't request this, you can safely ignore this email.",
          "",
          contactTextLine(),
          "",
          "The 7eats team",
        ].join("\n"),
        html: htmlEmail({
          title: "Reset your password",
          preheader: "Reset your 7eats password. This link expires in 1 hour.",
          bodyHtml:
            paragraph("Hi,") +
            paragraph(
              "We received a request to reset your 7eats password. Tap the button below to set a new one. This link expires in 1 hour.",
            ) +
            paragraph(
              "If you did not request this, you can safely ignore this email and your password will stay the same.",
            ) +
            contactParagraph(),
          ctaLabel: "Reset password",
          ctaUrl: url,
        }),
      });
    },
  },
  emailVerification: {
    expiresIn: 60 * 60 * 24, // 24 hours
    sendOnSignUp: false, // we call sendVerificationEmail manually so we control callbackURL
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[verify-email] confirmation link for ${user.email}:\n${url}`,
        );
      } else {
        console.log(
          `[verify-email] sending confirmation link to ${user.email}`,
        );
      }
      await sendMail({
        to: user.email,
        subject: "Confirm your email for 7eats",
        text: [
          "Welcome to 7eats!",
          "",
          "Confirm your email address to activate your account:",
          url,
          "",
          "This link expires in 24 hours.",
          "",
          contactTextLine(),
          "",
          "The 7eats team",
        ].join("\n"),
        html: htmlEmail({
          title: "Confirm your email",
          preheader:
            "Confirm your email address to activate your 7eats account.",
          bodyHtml:
            paragraph("Welcome to 7eats!") +
            paragraph(
              "Tap the button below to confirm your email address and activate your account. This link expires in 24 hours.",
            ) +
            paragraph(
              "If you didn't create a 7eats account, you can safely ignore this email.",
            ) +
            contactParagraph(),
          ctaLabel: "Confirm email",
          ctaUrl: url,
        }),
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
      onboardingCompletedAt: { type: "string", required: false },
      isGuestAccount: { type: "boolean", defaultValue: false, required: false },
      dateOfBirth: { type: "string", required: false },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 900, max: 5 },
      "/sign-up/email": { window: 900, max: 5 },
      "/forget-password": { window: 900, max: 5 },
    },
  },
  // Shares rate-limit counters across serverless instances via Neon instead
  // of Better Auth's default in-memory Map (see lib/auth-secondary-storage.ts).
  secondaryStorage: authSecondaryStorage,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (() => {
      throw new Error("BETTER_AUTH_SECRET is not set");
    })(),
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});
