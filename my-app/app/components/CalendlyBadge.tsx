"use client";

import { useEffect } from "react";

const CALENDLY_URL =
  "https://calendly.com/maddasi04?primary_color=d64045";

declare global {
  interface Window {
    Calendly?: {
      initBadgeWidget: (opts: {
        url: string;
        text: string;
        color: string;
        textColor: string;
        branding: boolean;
      }) => void;
      showPopupWidget: (url: string) => void;
    };
  }
}

export { CALENDLY_URL };

export default function CalendlyBadge() {
  useEffect(() => {
    const init = () => {
      window.Calendly?.initBadgeWidget({
        url: CALENDLY_URL,
        text: "Meet with the team",
        color: "#d64045",
        textColor: "#000000",
        branding: true,
      });
    };

    if (window.Calendly) {
      init();
    } else {
      window.addEventListener("calendly:loaded", init, { once: true });
    }

    return () => {
      window.removeEventListener("calendly:loaded", init);
    };
  }, []);

  return null;
}
