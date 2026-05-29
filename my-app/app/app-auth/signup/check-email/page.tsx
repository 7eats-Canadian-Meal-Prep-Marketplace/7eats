import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import ResendButton from "./ResendButton";

export const metadata: Metadata = {
  title: "Confirm your email — 7eats",
};

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Almost there</p>
        <h1 className={styles.title}>Confirm your email</h1>
        <p className={styles.body}>
          We sent a confirmation link to{" "}
          {email ? <strong>{email}</strong> : "your email address"}. Click it to
          activate your account, then sign in.
        </p>
        <p className={styles.hint}>
          Didn’t get it? Check your spam folder, or resend below.
        </p>

        {email ? <ResendButton email={email} /> : null}

        <p className={styles.altAction}>
          <Link href="/app-auth/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
