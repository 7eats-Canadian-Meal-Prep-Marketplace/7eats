"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./CreatePasswordForm.module.css";

export default function CreatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    // TODO: Call server action — hash password, upsert user record, create Neon Auth session
    router.push("/business-auth/setup/verify-phone");
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
          disabled={loading}
        >
          {loading ? "Continuing…" : "Continue to setup"}
        </button>
      </div>
    </form>
  );
}
