"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import styles from "./page.module.css";

export default function ResendButton({ email }: { email: string }) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const handleResend = () => {
    startTransition(async () => {
      // Better Auth's own endpoint (exposed via the /api/auth catch-all).
      const res = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          callbackURL: "/app-auth/onboarding",
        }),
      });
      if (res.ok) {
        setSent(true);
        toast.success("Confirmation email sent.");
      } else {
        toast.error("Couldn’t resend right now. Try again in a moment.");
      }
    });
  };

  return (
    <button
      type="button"
      className={`btn btn-primary ${styles.resend}`}
      disabled={isPending || sent}
      onClick={handleResend}
    >
      {isPending
        ? "Sending…"
        : sent
          ? "Email sent"
          : "Resend confirmation email"}
    </button>
  );
}
