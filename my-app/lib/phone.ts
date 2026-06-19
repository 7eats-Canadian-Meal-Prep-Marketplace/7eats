const PHONE_DIGITS = 10;

/** Keep only digits, dropping a leading "1" country code, capped at 10. */
export function phoneDigits(value: string): string {
  let d = value.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.slice(0, PHONE_DIGITS);
}

export function isValidNorthAmericanPhone(value: string): boolean {
  return phoneDigits(value).length === PHONE_DIGITS;
}

/** Display digits as "(416) 555-0100", formatting progressively as typed. */
export function formatPhoneDisplay(value: string): string {
  const d = phoneDigits(value);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function phoneToE164(value: string): string | null {
  const d = phoneDigits(value);
  if (d.length !== PHONE_DIGITS) return null;
  return `+1${d}`;
}
