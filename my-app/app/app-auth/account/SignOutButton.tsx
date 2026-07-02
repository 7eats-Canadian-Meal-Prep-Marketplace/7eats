"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./page.module.css";

export default function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      const res = await fetch("/api/auth/sign-out", { method: "POST" });
      const data = await res.json();
      router.push(data.redirect ?? "/app-auth/login");
    });
  };

  return (
    <button
      type="button"
      className={`btn btn-primary ${styles.signOut}`}
      disabled={isPending}
      onClick={handleSignOut}
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
