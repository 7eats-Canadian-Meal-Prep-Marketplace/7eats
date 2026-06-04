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
  searchParams: Promise<{ verified?: string }>;
}) {
  const { verified } = await searchParams;

  return (
    <ClientAuthLayout>
      {verified ? (
        <p className={styles.notice}>Email confirmed — you can now sign in.</p>
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
