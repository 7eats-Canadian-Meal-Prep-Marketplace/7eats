"use client";

import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import styles from "./LoginForm.module.css";

// Shared by both audiences. The sign-in endpoint decides the redirect by role,
// so the only per-audience differences are the logo destination and whether a
// "create an account" link is shown (cooks are invite-only; clients self-serve).
export default function LoginForm({
  logoHref = "/business/home",
  signupHref,
  audience = "business",
  showLogo = true,
}: {
  logoHref?: string;
  signupHref?: string;
  audience?: "client" | "business";
  showLogo?: boolean;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const forgotPasswordHref =
    audience === "client"
      ? "/app-auth/forgot-password"
      : "/business-auth/forgot-password";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, audience }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      const next = searchParams.get("next");
      const safeNext =
        next?.startsWith("/app/") && !next.startsWith("//") ? next : null;
      const fallback =
        audience === "client" ? "/app/browse" : "/business/dashboard";
      const destination = safeNext ?? data.redirect ?? fallback;
      if (
        (audience === "client" && destination.startsWith("/business")) ||
        (audience === "business" && destination.startsWith("/app"))
      ) {
        setError(data.error ?? "This account cannot sign in here.");
        return;
      }
      router.push(destination);
    });
  };

  const formContent = (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.sub}>Sign in to your account to continue.</p>
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
          <div className={styles.inputWrap}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className={styles.forgotRow}>
            <Link href={forgotPasswordHref} className={styles.forgotLink}>
              Forgot password?
            </Link>
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

      {signupHref && (
        <p className={styles.altAction}>
          New to 7eats? <Link href={signupHref}>Create an account</Link>
        </p>
      )}
    </div>
  );

  // Standalone mode (used in business auth — includes logo + card wrapper)
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
