// Shared, lenient URL handling for optional "website / social link" inputs.
// Protocol is optional on input ("instagram.com/x") and normalized to https://.

export function normalizeUrl(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** True when empty (optional) or a parseable URL. */
export function isValidOptionalUrl(value: string): boolean {
  return value.trim() === "" || normalizeUrl(value) !== null;
}
