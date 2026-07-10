const STORAGE_KEY = "7eats-pending-checkout";

export type StoredPendingCheckout = {
  orderId: string;
  clientSecret: string;
  cookId: string;
  guestAccessToken?: string;
};

export function readStoredPendingCheckout(): StoredPendingCheckout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPendingCheckout;
    if (
      !parsed?.orderId ||
      !parsed?.clientSecret ||
      !parsed?.cookId ||
      typeof parsed.orderId !== "string" ||
      typeof parsed.clientSecret !== "string" ||
      typeof parsed.cookId !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredPendingCheckout(data: StoredPendingCheckout): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearStoredPendingCheckout(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
