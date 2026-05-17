"use client";

export default function CookiePreferencesLink() {
  function handleClick() {
    window.dispatchEvent(new Event("7eats:reopen-cookie-banner"));
  }

  return (
    <button type="button" className="cookie-prefs-link" onClick={handleClick}>
      Cookie consent
    </button>
  );
}
