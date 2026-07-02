"use client";

import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import authStyles from "@/app/components/ClientAuthLayout/client-auth.module.css";
import PasswordChecklist from "@/app/components/PasswordChecklist";
import { isPasswordValid, validatePassword } from "@/lib/password";
import styles from "./ResetPasswordForm.module.css";

export default function ResetPasswordForm({
  token,
  audience = "business",
  showLogo = true,
}: {
  token: string;
  audience?: "client" | "business";
  showLogo?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const formValid = isPasswordValid(password) && password === confirm;

  const logoHref = audience === "client" ? "/app/browse" : "/business/home";
  const loginHref =
    audience === "client" ? "/app-auth/login" : "/business-auth/login";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
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

  const formContent = (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h1 className={styles.title}>Set a new password</h1>
        <p className={styles.sub}>Choose a strong password you don't reuse.</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            New password
          </label>
          <div className={styles.inputWrap}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className={styles.input}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="Create a strong password"
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
        </div>

        <div className={styles.field}>
          <label htmlFor="confirm" className={styles.label}>
            Confirm password
          </label>
          <div className={styles.inputWrap}>
            <input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              className={styles.input}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError("");
              }}
              placeholder="Re-enter your password"
              required
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowConfirm((s) => !s)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <PasswordChecklist password={password} />

        {error && <p className={styles.error}>{error}</p>}

        <button
          type="submit"
          className={`btn btn-primary ${styles.submit}`}
          disabled={isPending || !formValid}
          aria-disabled={!formValid}
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
  );

  if (showLogo) {
    return (
      <div className={authStyles.formShell}>
        <Link href={logoHref} className={authStyles.logoLink}>
          <Image
            src="/7eats-logo.svg"
            alt="7eats"
            width={180}
            height={48}
            style={{ width: "auto" }}
            priority
          />
        </Link>
        <div className={authStyles.formCard}>{formContent}</div>
      </div>
    );
  }

  return formContent;
}
