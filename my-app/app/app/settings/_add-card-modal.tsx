"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { AlertCircle, Lock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  settingsAddCardElementsOptions,
  settingsAddCardPaymentElementOptions,
  stripePromise,
} from "@/lib/stripe/browser";
import { formatStripeCardError } from "@/lib/stripe/card-errors";
import { confirmSavedCardSetup } from "@/lib/stripe/confirm-card-setup";
import {
  fetchSetupClientSecret,
  verifySetupIntentOnServer,
} from "@/lib/stripe/fetch-setup-client-secret";
import { Skeleton } from "../_skeleton";
import styles from "./_add-card-modal.module.css";

function StripeFieldSkeleton() {
  return (
    <div className={styles.fieldSkeleton} aria-hidden>
      <Skeleton width="34%" height={10} radius={4} />
      <Skeleton width="100%" height={42} radius={10} />
      <div className={styles.fieldSkeletonRow}>
        <Skeleton width="48%" height={42} radius={10} />
        <Skeleton width="48%" height={42} radius={10} />
      </div>
    </div>
  );
}

function AddCardForm({
  onClose,
  onSaved,
  userEmail,
  clientSecret,
}: {
  onClose: () => void;
  onSaved: () => void;
  userEmail: string | null;
  clientSecret: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [elementReady, setElementReady] = useState(false);
  const [formComplete, setFormComplete] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postalComplete = postalCode.trim().length >= 3;

  async function handleSubmit() {
    if (!stripe || !elements || saving || !formComplete) return;
    if (!postalComplete) {
      setError("Enter the postal code for this card.");
      return;
    }
    if (!userEmail?.trim()) {
      setError("We couldn't verify your account email. Refresh and try again.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await confirmSavedCardSetup({
        stripe,
        elements,
        clientSecret,
        returnUrl: `${window.location.origin}/app/settings`,
        email: userEmail.trim(),
        postalCode: postalCode.trim(),
        verifyOnServer: verifySetupIntentOnServer,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(
        formatStripeCardError(
          err instanceof Error ? err : String(err),
          "Your card couldn't be saved. Try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    Boolean(
      stripe && elements && elementReady && formComplete && postalComplete,
    ) && !saving;

  return (
    <>
      <div className={styles.body}>
        <div
          className={`${styles.stripeHost} ${error ? styles.stripeHostError : ""}`}
        >
          <PaymentElement
            id="settings-add-card-element"
            options={settingsAddCardPaymentElementOptions}
            onReady={() => setElementReady(true)}
            onChange={(event) => {
              setFormComplete(event.complete);
              if (error) setError(null);
            }}
          />
          {!elementReady && (
            <div className={styles.skeletonOverlay} aria-hidden>
              <StripeFieldSkeleton />
            </div>
          )}
        </div>
        {elementReady && (
          <div className={styles.postalField}>
            <label
              htmlFor="settings-add-card-postal"
              className={styles.postalLabel}
            >
              Postal code
            </label>
            <input
              id="settings-add-card-postal"
              className={styles.postalInput}
              type="text"
              autoComplete="postal-code"
              placeholder="A1A 1A1"
              value={postalCode}
              maxLength={12}
              disabled={saving}
              onChange={(event) => {
                setPostalCode(event.target.value);
                if (error) setError(null);
              }}
            />
          </div>
        )}
        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={16} className={styles.errorIcon} aria-hidden />
            <p className={styles.errorMessage}>{error}</p>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <p className={styles.trust}>
          <Lock size={13} className={styles.trustIcon} aria-hidden />
          Encrypted by Stripe. 7eats never sees your full card number.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={() => void handleSubmit()}
            disabled={!canSave}
          >
            {saving ? "Saving…" : "Save card"}
          </button>
        </div>
      </div>
    </>
  );
}

export function AddCardModal({
  onClose,
  onSaved,
  userEmail,
}: {
  onClose: () => void;
  onSaved: () => void;
  userEmail: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetchSetupClientSecret()
      .then((secret) => {
        if (!cancelled) setClientSecret(secret);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? err.message
              : "Could not start secure card setup.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close dialog"
        className={styles.backdrop}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-card-title"
        className={styles.dialog}
      >
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Payment</p>
            <h2 id="add-card-title" className={styles.title}>
              Add a card
            </h2>
            <p className={styles.subtitle}>Saved for faster checkout</p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div aria-busy="true" aria-live="polite">
            <span className={styles.srOnly}>Loading secure form…</span>
            <div className={styles.body}>
              <div className={styles.stripeHost}>
                <StripeFieldSkeleton />
              </div>
            </div>
          </div>
        ) : loadError || !clientSecret ? (
          <>
            <div className={styles.body}>
              <p className={styles.error} role="alert">
                {loadError ?? "Could not load card form."}
              </p>
            </div>
            <div className={styles.footer}>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </div>
          </>
        ) : (
          <Elements
            stripe={stripePromise}
            options={settingsAddCardElementsOptions(clientSecret)}
          >
            <AddCardForm
              onClose={onClose}
              onSaved={onSaved}
              userEmail={userEmail}
              clientSecret={clientSecret}
            />
          </Elements>
        )}
      </div>
    </>,
    document.body,
  );
}
