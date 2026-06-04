"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import styles from "./ForgotPasswordForm.module.css";

type Stage = "email" | "sent";

export default function ForgotPasswordForm({
  expiredLink = false,
  audience = "business",
  showLogo = true,
}: {
  expiredLink?: boolean;
  audience?: "client" | "business";
  showLogo?: boolean;
}) {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(
    expiredLink
      ? "That reset link has expired or is no longer valid. Request a new one below."
      : "",
  );
  const [isPending, startTransition] = useTransition();

  const logoHref = audience === "client" ? "/app/browse" : "/business/home";
  const loginHref =
    audience === "client" ? "/app-auth/login" : "/business-auth/login";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, audience }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setStage("sent");
    });
  };

  const formContent = (
    <div className={styles.wrap}>
      {stage === "email" ? (
        <>
          <div className={styles.head}>
            <h1 className={styles.title}>Forgot password?</h1>
            <p className={styles.sub}>
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={`btn btn-primary ${styles.submit}`}
              disabled={isPending}
            >
              {isPending ? "Sending…" : "Send reset link"}
            </button>
          </form>

          <div className={styles.footer}>
            <Link href={loginHref} className={styles.backLink}>
              ← Back to sign in
            </Link>
          </div>
        </>
      ) : (
        <div className={styles.sentState}>
          <p className={styles.sentTitle}>Check your inbox</p>
          <p className={styles.sentSub}>
            If <strong>{email}</strong> is linked to an account, you'll receive
            a reset link shortly. Check your spam folder if it doesn't arrive.
          </p>
          <Link href={loginHref} className={styles.backLink}>
            ← Back to sign in
          </Link>
        </div>
      )}
    </div>
  );

  if (showLogo) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        <Link href={logoHref} className={styles.logoLink}>
          <Image
            src="/7eats-logo.svg"
            alt="7eats"
            width={180}
            height={48}
            style={{ width: "auto" }}
            priority
          />
        </Link>
        <div className={styles.card}>{formContent}</div>
      </div>
    );
  }

  return formContent;
}
