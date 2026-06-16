"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, useTransition } from "react";
import styles from "./CreatePasswordForm.module.css";

export default function CreatePasswordForm({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

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
      const res = await fetch("/api/setup/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      // Hard navigation so the new session cookie is sent with the next request
      window.location.href = data.redirect;
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.formHead}>
        <p className={styles.formStep}>Account setup</p>
        <h2 className={styles.formTitle}>Create your password</h2>
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <div className={styles.inputWrap}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className={styles.input}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="8+ characters"
              autoComplete="new-password"
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
              className={styles.input}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError("");
              }}
              placeholder="Re-enter your password"
              autoComplete="new-password"
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

        {error && <p className={styles.fieldError}>{error}</p>}

        <button
          type="submit"
          className={`btn btn-primary ${styles.ctaBtn}`}
          disabled={isPending}
        >
          {isPending ? "Continuing…" : "Continue to setup"}
        </button>
      </div>
    </form>
  );
}
