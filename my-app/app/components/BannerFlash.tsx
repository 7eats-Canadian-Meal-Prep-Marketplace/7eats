"use client";

import Link from "next/link";
import { useState } from "react";

export default function BannerFlash() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="flash" data-flash>
      <div className="flash-inner">
        <span className="flash-text">
          First <strong>30 cooks</strong> in Toronto keep <strong>100%</strong>{" "}
          of earnings for 90 days &middot;{" "}
          <span className="flash-offer">
            <Link className="flash-link" href="#offer">
              See the offer
            </Link>
          </span>
        </span>
      </div>
      <button
        type="button"
        className="flash-close"
        aria-label="Dismiss banner"
        onClick={() => setDismissed(true)}
      >
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <title>Close</title>
          <path
            d="M3 3l10 10M13 3L3 13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
