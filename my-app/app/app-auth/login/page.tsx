import type { Metadata } from "next";
import { Suspense } from "react";
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
    <main className={styles.page}>
      <div className={styles.stack}>
        {verified ? (
          <p className={styles.notice}>Email confirmed — please sign in.</p>
        ) : null}
        <Suspense fallback={null}>
          <LoginForm
            logoHref="/app/browse"
            signupHref="/app-auth/signup"
            audience="client"
          />
        </Suspense>
      </div>
    </main>
  );
}
