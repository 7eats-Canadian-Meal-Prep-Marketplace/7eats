import type { Metadata } from "next";
import LoginForm from "@/app/components/LoginForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Sign in | 7eats",
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <LoginForm />
    </main>
  );
}
