import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { ClientAuthLayout } from "@/app/components/ClientAuthLayout";
import LoginForm from "@/app/components/LoginForm";
import { auth } from "@/lib/auth";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Sign in - 7eats",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    verified?: string;
    error?: string;
    deleted?: string;
  }>;
}) {
  const { verified, error, deleted } = await searchParams;

  // A signed-in cook/admin can sign in here as a customer. Signing in swaps the
  // single session cookie, so warn them it logs them out of the cook account.
  const session = await auth.api.getSession({ headers: await headers() });
  const switchingFromCook =
    session?.user.role === "cook" || session?.user.role === "admin";

  const verificationError =
    error === "invalid_token" || error === "INVALID_TOKEN"
      ? "That confirmation link has expired or is no longer valid. Sign in or sign up again to request a new one."
      : error
        ? "We could not confirm your email. Try signing in or request a new confirmation link."
        : null;

  return (
    <ClientAuthLayout>
      {switchingFromCook ? (
        <p className={styles.notice}>
          You're signed in as a cook. Signing in below will switch you to a
          customer account and log you out of the cook dashboard.
        </p>
      ) : null}
      {verified ? (
        <p className={styles.notice}>Email confirmed. You can now sign in.</p>
      ) : null}
      {deleted ? (
        <p className={styles.plainNotice}>
          Your account has been deleted. This is permanent and cannot be undone.
        </p>
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
