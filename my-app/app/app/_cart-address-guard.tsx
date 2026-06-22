"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import styles from "./_cart-address-guard.module.css";
import { useCart } from "./_cart-context";

type PendingChange = { apply: () => void; label: string };

type GuardContextValue = {
  /**
   * Run an address change through the guard. If there's an active delivery cart
   * whose kitchen can't deliver to the new address, this opens a confirm dialog
   * and only applies the change (clearing the cart) if the user agrees.
   * Otherwise it applies immediately. Pickup carts are never affected — pickup
   * is fulfilled at the kitchen regardless of the customer's address.
   */
  requestAddressChange: (
    coords: { lat: number; lng: number },
    label: string,
    apply: () => void,
  ) => Promise<void>;
};

const CartAddressGuardContext = createContext<GuardContextValue | null>(null);

export function useCartAddressGuard(): GuardContextValue {
  const ctx = useContext(CartAddressGuardContext);
  if (!ctx) {
    throw new Error(
      "useCartAddressGuard must be used within CartAddressGuardProvider",
    );
  }
  return ctx;
}

export function CartAddressGuardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { fulfillmentMode, cookId, cookName, items, clearCart } = useCart();
  const [pending, setPending] = useState<PendingChange | null>(null);

  const requestAddressChange = useCallback(
    async (
      coords: { lat: number; lng: number },
      label: string,
      apply: () => void,
    ) => {
      // Only a delivery cart can be made unfulfillable by an address change.
      if (fulfillmentMode !== "delivery" || !cookId || items.length === 0) {
        apply();
        return;
      }
      try {
        const res = await fetch("/api/delivery/distance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cookId,
            customerLat: coords.lat,
            customerLng: coords.lng,
          }),
        });
        const data = res.ok ? await res.json() : null;
        // Still deliverable (or we can't tell) → apply silently. The order
        // placement endpoint is the authoritative gate either way.
        if (!data || !data.isOutOfRange) {
          apply();
          return;
        }
        setPending({ apply, label });
      } catch {
        // Network hiccup — don't trap the user; the server still guards placement.
        apply();
      }
    },
    [fulfillmentMode, cookId, items.length],
  );

  const keep = useCallback(() => setPending(null), []);
  const changeAnyway = useCallback(() => {
    setPending((p) => {
      if (p) {
        clearCart();
        p.apply();
      }
      return null;
    });
  }, [clearCart]);

  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") keep();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, keep]);

  return (
    <CartAddressGuardContext.Provider value={{ requestAddressChange }}>
      {children}
      {pending && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="addr-guard-title"
        >
          {/* Backdrop click cancels (keeps the current address + order). */}
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Keep current address"
            onClick={keep}
          />
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <h2 id="addr-guard-title" className={styles.title}>
                Change address?
              </h2>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.body}>
                {cookName ?? "This kitchen"} can&apos;t deliver to:
              </p>
              <p className={styles.addressLine}>
                {pending.label || "your new address"}
              </p>
              <p className={styles.note}>
                Changing your address will clear this order.
              </p>
            </div>
            <div className={styles.cardFoot}>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={keep}
                >
                  Keep current address
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={changeAnyway}
                >
                  Change &amp; clear order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CartAddressGuardContext.Provider>
  );
}
