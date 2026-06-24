import type { Metadata } from "next";
import Link from "next/link";
import { ClientAuthLayout } from "@/app/components/ClientAuthLayout";
import styles from "./page.module.css";
import ResendButton from "./ResendButton";

export const metadata: Metadata = {
  title: "Confirm your email - 7eats",
};

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <ClientAuthLayout>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>Almost there</p>
        <h1 className={styles.title}>Check your inbox</h1>
        <p className={styles.body}>
          We sent a confirmation link to{" "}
          {email ? <strong>{email}</strong> : "your email address"}. Click it to
          activate your account and get started.
        </p>
        <p className={styles.hint}>Can't find it? Check your spam folder.</p>

        {email ? <ResendButton email={email} /> : null}

        <p className={styles.altAction}>
          <Link href="/app-auth/login">← Back to sign in</Link>
        </p>
      </div>
    </ClientAuthLayout>
  );
}
