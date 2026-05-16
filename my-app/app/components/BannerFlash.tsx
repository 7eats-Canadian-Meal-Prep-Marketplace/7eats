"use client";

import { X } from "lucide-react";
import { useState } from "react";
import s from "./BannerFlash.module.css";

export default function BannerFlash() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={s.banner} role="banner">
      <p className={s.text}>
        <span className={s.badge}>Limited</span>
        First 40 cooks get lifetime reduced commission and a founding cook badge
        - spots are filling fast.
      </p>
      <button
        className={s.dismiss}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
      >
        <X size={16} />
      </button>
    </div>
  );
}
