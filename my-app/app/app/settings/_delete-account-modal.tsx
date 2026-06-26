"use client";

import { Eye, EyeOff, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Skeleton } from "../_skeleton";
import styles from "./_delete-account-modal.module.css";

type BlockingOrder = { id: string; status: string };

export function DeleteAccountModal({
  onClose,
  onDeleted,
}: {
  onClose: () => void;
  onDeleted: (redirect: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [blockingOrders, setBlockingOrders] = useState<BlockingOrder[]>([]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, submitting]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/account")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Could not check account status.");
        }
        if (!cancelled) {
          setEligible(Boolean(json.data?.eligible));
          setBlockingOrders(json.data?.blockingOrders ?? []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not check account status.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEligibility(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eligible || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Could not delete account.");
      }
      onDeleted(json.redirect ?? "/app-auth/login?deleted=1");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close dialog"
        className={styles.backdrop}
        onClick={submitting ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className={styles.dialog}
      >
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Danger zone</p>
            <h2 id="delete-account-title" className={styles.title}>
              Delete your account?
            </h2>
            <p className={styles.subtitle}>
              This is permanent. There is no grace period and we cannot restore
              your account. Your profile, saved cards, and preferences will be
              removed. Past orders stay on record for payment history. Reviews
              you posted keep the name and text you submitted.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {loadingEligibility ? (
            <div className={styles.loadingState} aria-busy="true" aria-hidden>
              <Skeleton width={148} height={11} radius={6} />
              <Skeleton width="100%" height={48} radius={12} />
              <div className={styles.loadingActions}>
                <Skeleton width="100%" height={42} radius={999} />
                <Skeleton width="100%" height={42} radius={999} />
              </div>
            </div>
          ) : !eligible ? (
            <div className={styles.blockerBox} role="alert">
              <p className={styles.blockerTitle}>
                You have active orders that need to finish first.
              </p>
              <p className={styles.blockerText}>
                Cancel or wait until every open order is fulfilled before
                deleting your account.
              </p>
              <ul className={styles.blockerList}>
                {blockingOrders.map((order) => (
                  <li key={order.id}>
                    <Link href={`/app/orders/${order.id}`} onClick={onClose}>
                      View order
                    </Link>
                    <span className={styles.blockerStatus}>{order.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="delete-password" className={styles.label}>
                  Confirm with password
                </label>
                <div className={styles.inputWrap}>
                  <input
                    id="delete-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    required
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPassword((s) => !s)}
                    disabled={submitting}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={onClose}
                  disabled={submitting}
                >
                  Keep account
                </button>
                <button
                  type="submit"
                  className={styles.deleteBtn}
                  disabled={submitting || password.length === 0}
                >
                  {submitting ? "Deleting…" : "Delete account"}
                </button>
              </div>
            </form>
          )}
          {!loadingEligibility && !eligible && error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
