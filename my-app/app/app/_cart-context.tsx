"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { SubscriptionInterval } from "@/lib/subscription-schedule";

export type CartItem = {
  dishId: string;
  dishName: string;
  dishEmoji: string;
  listingId: string;
  listingTitle: string;
  orderType: "one_time" | "subscription";
  /** Selected subscription tier, set when orderType is "subscription". */
  tierId?: string;
  subscriptionInterval?: SubscriptionInterval;
  fulfillmentMode: "pickup" | "delivery";
  cookId: string;
  cookName: string;
  cookInitials: string;
  cookGradient: string;
  price: number;
  quantity: number;
};

export type CartMode = "one-time" | "subscription" | "mixed";

type CartContextType = {
  items: CartItem[];
  /** Replace all cart lines for one listing (commit from listing page). */
  setListingItems: (
    listingId: string,
    lines: Array<Omit<CartItem, "quantity"> & { quantity: number }>,
  ) => void;
  removeListing: (listingId: string) => void;
  clearCart: () => void;
  /** Distinct listings in the cart (badge count). */
  listingCount: number;
  total: number;
  /** Drives checkout payment flow and consent UI. */
  cartMode: CartMode;
  /** True if any cart item requires delivery. */
  needsDeliveryAddress: boolean;
};

const CartContext = createContext<CartContextType | null>(null);

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const setListingItems = useCallback(
    (
      listingId: string,
      lines: Array<Omit<CartItem, "quantity"> & { quantity: number }>,
    ) => {
      const committed = lines.filter((l) => l.quantity > 0);
      setItems((prev) => [
        ...prev.filter((i) => i.listingId !== listingId),
        ...committed,
      ]);
    },
    [],
  );

  const removeListing = useCallback((listingId: string) => {
    setItems((prev) => prev.filter((i) => i.listingId !== listingId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const listingCount = useMemo(
    () => new Set(items.map((i) => i.listingId)).size,
    [items],
  );

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items],
  );

  const cartMode = useMemo<CartMode>(() => {
    if (items.length === 0) return "one-time";
    const types = new Set(items.map((i) => i.orderType));
    if (types.has("one_time") && types.has("subscription")) return "mixed";
    if (types.has("subscription")) return "subscription";
    return "one-time"; // cartMode uses hyphen for UI (not sent to API)
  }, [items]);

  const needsDeliveryAddress = useMemo(
    () => items.some((i) => i.fulfillmentMode === "delivery"),
    [items],
  );

  return (
    <CartContext.Provider
      value={{
        items,
        setListingItems,
        removeListing,
        clearCart,
        listingCount,
        total,
        cartMode,
        needsDeliveryAddress,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
