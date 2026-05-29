import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ResetPasswordForm from "@/app/components/ResetPasswordForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Reset password | 7eats",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    redirect("/business-auth/forgot-password");
  }

  return (
    <main className={styles.page}>
      <ResetPasswordForm token={token} />
    </main>
  );
}
