import type { Metadata } from "next";
import ForgotPasswordForm from "@/app/components/ForgotPasswordForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Forgot password | 7eats",
};

export default function ForgotPasswordPage() {
  return (
    <main className={styles.page}>
      <ForgotPasswordForm />
    </main>
  );
}
