"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { login } from "@/app/business-auth/login/actions";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await login({ email, password });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className={styles.wrap}>
      <Link href="/business/home" className={styles.logoLink}>
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
          <h1 className={styles.title}>Sign in</h1>
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

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {/* TODO M9+: wire forgot-password page */}
            <div className={styles.forgotRow}>
              <span className={styles.forgotPlaceholder}>Forgot password?</span>
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={`btn btn-primary ${styles.submit}`}
            disabled={isPending}
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
