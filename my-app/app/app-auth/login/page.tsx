import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientAuthLayout } from "@/app/components/ClientAuthLayout";
import LoginForm from "@/app/components/LoginForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Sign in — 7eats",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; error?: string }>;
}) {
  const { verified, error } = await searchParams;

  const verificationError =
    error === "invalid_token" || error === "INVALID_TOKEN"
      ? "That confirmation link has expired or is no longer valid. Sign in or sign up again to request a new one."
      : error
        ? "We could not confirm your email. Try signing in or request a new confirmation link."
        : null;

  return (
    <ClientAuthLayout>
      {verified ? (
        <p className={styles.notice}>Email confirmed — you can now sign in.</p>
      ) : null}
      {verificationError ? (
        <p className={styles.errorNotice} role="alert">
          {verificationError}
        </p>
      ) : null}
      <Suspense fallback={null}>
        <LoginForm
          logoHref="/app/browse"
          signupHref="/app-auth/signup"
          audience="client"
        />
      </Suspense>
    </ClientAuthLayout>
  );
}
