"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONSENT_KEY = "7eats_cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }

    function handleReopen() {
      try {
        localStorage.removeItem(CONSENT_KEY);
      } catch {
        // ignore storage errors; still reopen the banner
      }
      setVisible(true);
    }

    window.addEventListener("7eats:reopen-cookie-banner", handleReopen);
    return () =>
      window.removeEventListener("7eats:reopen-cookie-banner", handleReopen);
  }, []);

  function dismiss(choice: string) {
    try {
      localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      // ignore storage errors; still hide the banner
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section className="cookie-banner" aria-label="Cookie consent">
      <div className="cookie-banner-inner">
        <p className="cookie-banner-text">
          This site uses essential cookies only. We do not use analytics or
          tracking cookies.{" "}
          <Link href="/privacy" className="cookie-banner-link">
            Privacy Policy
          </Link>
        </p>
        <div className="cookie-banner-actions">
          <button
            type="button"
            className="cookie-btn cookie-btn-ghost"
            onClick={() => dismiss("refused")}
          >
            Refuse all
          </button>
          <button
            type="button"
            className="cookie-btn cookie-btn-secondary"
            onClick={() => dismiss("essential")}
          >
            Essential only
          </button>
          <button
            type="button"
            className="cookie-btn cookie-btn-primary"
            onClick={() => dismiss("accepted")}
          >
            Accept all
          </button>
        </div>
      </div>
    </section>
  );
}
