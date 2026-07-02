import type { Metadata } from "next";
import ForgotPasswordForm from "@/app/components/ForgotPasswordForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Forgot password - 7eats",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className={styles.page}>
      <ForgotPasswordForm expiredLink={error === "expired"} />
    </main>
  );
}
