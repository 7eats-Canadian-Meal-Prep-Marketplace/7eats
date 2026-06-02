"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import styles from "./ResetPasswordForm.module.css";

export default function ResetPasswordForm({
  token,
  audience = "business",
}: {
  token: string;
  audience?: "client" | "business";
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const logoHref = audience === "client" ? "/app/browse" : "/business/home";
  const loginHref =
    audience === "client" ? "/app-auth/login" : "/business-auth/login";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password, audience }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      window.location.href = data.redirect;
    });
  };

  return (
    <div className={styles.wrap}>
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

      <div className={styles.card}>
        <div className={styles.head}>
          <h1 className={styles.title}>Set a new password</h1>
          <p className={styles.sub}>Must be at least 8 characters.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className={styles.input}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="confirm" className={styles.label}>
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              className={styles.input}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError("");
              }}
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={`btn btn-primary ${styles.submit}`}
            disabled={isPending}
          >
            {isPending ? "Saving…" : "Set new password"}
          </button>
        </form>

        <div className={styles.footer}>
          <Link href={loginHref} className={styles.backLink}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
