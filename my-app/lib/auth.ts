import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
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
    sendResetPassword: async ({ user, url }) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@7eats.ca",
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
          "The 7eats team",
        ].join("\n"),
      });
      if (error) throw new Error(error.message);
    },
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
