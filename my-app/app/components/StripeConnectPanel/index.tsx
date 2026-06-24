"use client";

import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isStripeFullyConnected } from "@/lib/stripe-connect";
import styles from "./StripeConnectPanel.module.css";

type StripeStatusData = {
  hasAccount: boolean;
  transfersActive: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
  requirementsCount: number;
  requirements: string[];
};

type Props = {
  /** Where Stripe sends the cook after onboarding (path only). */
  returnTo?: string;
  /** `row` matches settings billing; `card` matches onboarding step 4. */
  layout?: "row" | "card";
  onConnectedChange?: (connected: boolean) => void;
};

const STATUS_FETCH: RequestInit = { cache: "no-store" };

/** Background poll cadence while waiting for Stripe onboarding to complete. */
const POLL_INTERVAL_MS = 6000;
/** Stop polling after ~5 min so an abandoned setup doesn't hit Stripe forever. */
const POLL_MAX_ATTEMPTS = 50;

export default function StripeConnectPanel({
  returnTo = "/business/settings",
  layout = "row",
  onConnectedChange,
}: Props) {
  const [status, setStatus] = useState<StripeStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);

  const isConnected = status ? isStripeFullyConnected(status) : false;

  const loadStatus = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch(
        "/api/business/dashboard/stripe/status",
        STATUS_FETCH,
      );
      const json = await res.json();
      if (json.success) setStatus(json.data);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const pollUntilConnected = useCallback(async () => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      try {
        const res = await fetch(
          "/api/business/dashboard/stripe/status",
          STATUS_FETCH,
        );
        const json = await res.json();
        if (json.success) {
          setStatus(json.data);
          if (isStripeFullyConnected(json.data)) return;
        }
      } catch {
        // Keep polling after transient failures.
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const onConnectedChangeRef = useRef(onConnectedChange);
  onConnectedChangeRef.current = onConnectedChange;

  useEffect(() => {
    onConnectedChangeRef.current?.(isConnected);
  }, [isConnected]);

  useEffect(() => {
    const refresh = () => {
      void loadStatus({ silent: true });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadStatus]);

  // Poll while the cook has a started-but-incomplete Stripe account so the panel
  // flips to "Connected" shortly after they finish onboarding. Bounded so a cook
  // who never completes setup doesn't poll the live Stripe API forever.
  useEffect(() => {
    if (!status?.hasAccount || isConnected) return;

    let attempts = 0;
    const interval = window.setInterval(() => {
      // Don't burn Stripe API calls while the tab is backgrounded.
      if (document.visibilityState !== "visible") return;
      attempts += 1;
      if (attempts > POLL_MAX_ATTEMPTS) {
        window.clearInterval(interval);
        return;
      }
      void loadStatus({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [status?.hasAccount, isConnected, loadStatus]);

  async function handleStripeAction() {
    setLinkLoading(true);
    try {
      let current = status;

      if (!current?.hasAccount) {
        const createRes = await fetch("/api/setup/stripe-connect", {
          method: "POST",
        });
        if (!createRes.ok) {
          const json = await createRes.json().catch(() => ({}));
          throw new Error(json.error ?? "Failed to create Stripe account.");
        }
        const statusRes = await fetch(
          "/api/business/dashboard/stripe/status",
          STATUS_FETCH,
        );
        const statusJson = await statusRes.json();
        if (statusJson.success) {
          current = statusJson.data;
          setStatus(current);
        }
      }

      const fullyConnected = current ? isStripeFullyConnected(current) : false;
      const endpoint = fullyConnected
        ? "/api/business/dashboard/stripe/dashboard-link"
        : "/api/business/dashboard/stripe/onboarding-link";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo }),
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        const popup = window.open(json.data.url, "_blank");
        if (popup) {
          const timer = window.setInterval(() => {
            if (popup.closed) {
              window.clearInterval(timer);
              void pollUntilConnected();
            }
          }, 500);
        } else {
          void pollUntilConnected();
        }
      }
    } catch (err) {
      console.error("[StripeConnectPanel]", err);
    } finally {
      setLinkLoading(false);
    }
  }

  const badgeLabel = isConnected ? "Connected" : "Not connected";
  const badgeClass = isConnected
    ? styles.badgeConnected
    : styles.badgeDisconnected;
  const actionLabel = linkLoading
    ? "Opening…"
    : isConnected
      ? "Open Stripe dashboard"
      : status?.hasAccount
        ? "Continue in Stripe"
        : "Connect with Stripe";

  const subCopy = isConnected
    ? "You're set up to receive payouts. 7eats deposits earnings to your bank through Stripe. We never see your banking details."
    : "7eats uses Stripe to deposit your earnings directly to your bank account. We never see your banking details.";

  const setupNote =
    status?.hasAccount && !isConnected ? (
      <p className={styles.details}>
        {status.onboardingComplete
          ? "Stripe is processing your details. This usually takes a few seconds. We will refresh automatically."
          : layout === "card"
            ? "Your Stripe account is started but not finished yet. Use the button below to complete bank and verification in Stripe."
            : "Your Stripe account is started but not finished yet. Click Continue in Stripe to complete bank and verification."}
      </p>
    ) : null;

  const actionButton = (
    <button
      type="button"
      className={
        layout === "card" && !isConnected ? styles.btnPrimary : styles.btn
      }
      onClick={handleStripeAction}
      disabled={loading || linkLoading}
    >
      {actionLabel}
      <ExternalLink size={13} />
    </button>
  );

  if (layout === "card") {
    return (
      <div className={styles.panelCard}>
        <div className={styles.header}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={styles.icon}
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <span className={styles.title}>Stripe Connect</span>
          {!loading && (
            <span
              className={`${styles.badge} ${badgeClass} ${styles.badgeEnd}`}
            >
              {badgeLabel}
            </span>
          )}
        </div>
        <p className={styles.sub}>{subCopy}</p>
        {loading ? (
          <p className={styles.loading}>Loading…</p>
        ) : (
          <>
            {setupNote}
            <div className={styles.actions}>{actionButton}</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.panel}>
        {loading ? (
          <span className={styles.loading}>Loading…</span>
        ) : (
          <>
            <span className={`${styles.badge} ${badgeClass}`}>
              {badgeLabel}
            </span>
            {setupNote}
          </>
        )}
      </div>
      {actionButton}
    </div>
  );
}
