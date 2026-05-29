import type { Metadata } from "next";
import SignupForm from "@/app/components/SignupForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Create your account — 7eats",
};

export default function SignupPage() {
  return (
    <main className={styles.page}>
      <SignupForm />
    </main>
  );
}
