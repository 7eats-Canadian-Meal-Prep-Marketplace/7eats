"use client";

import { CALENDLY_URL } from "./CalendlyBadge";

interface CalendlyButtonProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export default function CalendlyButton({
  className,
  style,
  children,
}: CalendlyButtonProps) {
  function handleClick() {
    window.Calendly?.showPopupWidget(CALENDLY_URL);
  }

  return (
    <button type="button" className={className} style={style} onClick={handleClick}>
      {children}
    </button>
  );
}
