"use client";

import { useState, useTransition } from "react";
import { createAccount } from "@/app/business-auth/setup/create-password/actions";
import styles from "./CreatePasswordForm.module.css";

export default function CreatePasswordForm({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
      const result = await createAccount(token, password);
      if (result?.error) {
        setError(result.error);
      }
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
          <input
            id="password"
            type="password"
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
        </div>

        <div className={styles.field}>
          <label htmlFor="confirm" className={styles.label}>
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
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
