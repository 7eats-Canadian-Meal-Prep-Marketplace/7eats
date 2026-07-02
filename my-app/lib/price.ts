/**
 * Shared helpers for money / price inputs across the app.
 *
 * A "price string" is a plain decimal: digits with an optional decimal point
 * and at most two fractional digits. No currency symbols, letters, thousands
 * separators, or scientific notation.
 */

/** Matches a complete, well-formed price such as "12" or "12.50". */
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Matches in-progress input while typing, e.g. "", "1", "1.", "1.2". */
const PRICE_KEYSTROKE_PATTERN = /^\d*\.?\d{0,2}$/;

/**
 * Whether an in-progress input value is an acceptable price keystroke.
 *
 * Use inside an input's `onChange` to reject letters and extra decimals as the
 * user types, while still allowing partial values like "" or "1.".
 */
export function isPriceKeystroke(value: string): boolean {
  return value === "" || PRICE_KEYSTROKE_PATTERN.test(value);
}

/**
 * Whether a final price string is valid: correctly formatted (digits, optional
 * decimal point, at most two decimals) and greater than zero. Empty strings are
 * not valid prices.
 */
export function isValidPrice(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || !PRICE_PATTERN.test(trimmed)) return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0;
}
