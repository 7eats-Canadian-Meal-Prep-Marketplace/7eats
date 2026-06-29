import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/app/components/LoginForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Sign in - 7eats",
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
