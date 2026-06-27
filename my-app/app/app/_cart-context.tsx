"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { computeLineTotal } from "@/lib/order-pricing";

/** A single dish line in the cart. */
export type CartItem = {
  dishId: string;
  name: string;
  /** Base price per unit (dishes.price). */
  price: number;
  quantity: number;
  promotionId: string | null;
  /** Dollar discount applied to this line (0 when no promotion). */
  discountAmount: number;
  /** (price * quantity) - discountAmount. */
  lineTotal: number;
};

export type DeliveryAddress = {
  street: string;
  unit?: string;
  city: string;
  province: string;
  postal: string;
  lat?: number;
  lng?: number;
};

type AddItemInput = {
  cookId: string;
  cookName: string;
  cookProvince: string;
  minOrderQty: number;
  maxOrderQty: number | null;
  leadTime: string | null;
  cancellationAllowed: boolean;
  item: CartItem;
};

type CartContextType = {
  cookId: string | null;
  cookName: string | null;
  /** Cook pickup province for tax (place of supply). Defaults to ON when unset. */
  cookProvince: string;
  minOrderQty: number;
  maxOrderQty: number | null;
  leadTime: string | null;
  cancellationAllowed: boolean;
  items: CartItem[];
  fulfillmentMode: "pickup" | "delivery";
  deliveryAddress: DeliveryAddress | null;
  notes: string | null;
  deliveryDetails: string | null;
  /** Total number of items across all dishes. */
  totalQuantity: number;
  /** Sum of all line totals. */
  subtotal: number;
  meetsMinimum: boolean;
  withinMaximum: boolean;
  /**
   * Add or replace a dish line. If the dish belongs to a different cook than
   * the current cart, returns `{ conflict: true }` without mutating — the caller
   * should confirm and then call `clearAndAdd`.
   */
  addItem: (input: AddItemInput) => { conflict: boolean };
  clearAndAdd: (input: AddItemInput) => void;
  removeItem: (dishId: string) => void;
  clearCart: () => void;
  setFulfillment: (mode: "pickup" | "delivery") => void;
  setDeliveryAddress: (addr: DeliveryAddress | null) => void;
  setNotes: (notes: string | null) => void;
  setDeliveryDetails: (details: string | null) => void;
};

/**
 * Shape persisted to localStorage so the cart survives a page refresh
 * (important for guests, who have no server-side cart). Bump the version
 * suffix if the stored shape changes in a breaking way.
 */
const STORAGE_KEY = "7eats:cart:v2";

/**
 * How long a persisted cart stays valid. Long enough to survive a few days of
 * "leave and come back", short enough that prices/availability can't go badly
 * stale. After this, the cart is dropped on next load.
 */
const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type PersistedCart = {
  cook: CookMeta | null;
  items: CartItem[];
  fulfillmentMode: "pickup" | "delivery";
  deliveryAddress: DeliveryAddress | null;
  notes: string | null;
  deliveryDetails: string | null;
  /** Epoch ms of the last write — used to expire stale carts. */
  savedAt?: number;
};

/** Read and validate the persisted cart. Returns null on any problem or if stale. */
function loadPersistedCart(): PersistedCart | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem("7eats:cart:v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedCart>;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    // Drop carts older than the TTL (older entries without a timestamp are kept
    // until their next write, which stamps them).
    if (parsed.savedAt && Date.now() - parsed.savedAt > CART_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      cook: parsed.cook ?? null,
      items: parsed.items,
      fulfillmentMode:
        parsed.fulfillmentMode === "delivery" ? "delivery" : "pickup",
      deliveryAddress: parsed.deliveryAddress ?? null,
      notes: parsed.notes ?? null,
      deliveryDetails: parsed.deliveryDetails ?? null,
    };
  } catch {
    // Corrupt or unreadable storage — start with an empty cart.
    return null;
  }
}

const CartContext = createContext<CartContextType | null>(null);

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

type CookMeta = {
  cookId: string;
  cookName: string;
  cookProvince: string;
  minOrderQty: number;
  maxOrderQty: number | null;
  leadTime: string | null;
  cancellationAllowed: boolean;
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cook, setCook] = useState<CookMeta | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [fulfillmentMode, setFulfillmentMode] = useState<"pickup" | "delivery">(
    "pickup",
  );
  const [deliveryAddress, setDeliveryAddressState] =
    useState<DeliveryAddress | null>(null);
  const [notes, setNotesState] = useState<string | null>(null);
  const [deliveryDetails, setDeliveryDetailsState] = useState<string | null>(
    null,
  );

  // Tracks whether we've hydrated from localStorage yet. This is reactive STATE,
  // not a ref: the persist effect below depends on it, so its first run on mount
  // sees `hydrated === false` (the render-time value) and skips. A ref set inside
  // the hydrate effect would already read `true` in the same commit pass, while
  // the cart state is still empty — overwriting the saved cart with an empty one
  // (and, under StrictMode's double-invoked effects, wiping it permanently).
  const [hydrated, setHydrated] = useState(false);

  // Hydrate once on mount. Done in an effect (not a lazy useState initializer)
  // so the server-rendered and first client render stay in sync — avoiding a
  // hydration mismatch — and the saved cart is applied immediately after. All
  // the setState calls (including setHydrated) batch into one commit, so the
  // persist effect only runs once the saved cart is actually in state.
  useEffect(() => {
    const saved = loadPersistedCart();
    if (saved) {
      setCook(saved.cook);
      setItems(saved.items);
      setFulfillmentMode(saved.fulfillmentMode);
      setDeliveryAddressState(saved.deliveryAddress);
      setNotesState(saved.notes);
      setDeliveryDetailsState(saved.deliveryDetails);
    }
    setHydrated(true);
  }, []);

  // Persist whenever any cart field changes (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedCart = {
        cook,
        items,
        fulfillmentMode,
        deliveryAddress,
        notes,
        deliveryDetails,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage may be full or unavailable (private mode) — non-critical.
    }
  }, [
    hydrated,
    cook,
    items,
    fulfillmentMode,
    deliveryAddress,
    notes,
    deliveryDetails,
  ]);

  const upsert = useCallback((meta: CookMeta, item: CartItem) => {
    setCook(meta);
    setItems((prev) => {
      const rest = prev.filter((i) => i.dishId !== item.dishId);
      return item.quantity > 0 ? [...rest, item] : rest;
    });
  }, []);

  const addItem = useCallback(
    (input: AddItemInput) => {
      if (cook && cook.cookId !== input.cookId && items.length > 0) {
        return { conflict: true };
      }
      if (cook && cook.cookId !== input.cookId) {
        setNotesState(null);
        setDeliveryDetailsState(null);
      }
      upsert(
        {
          cookId: input.cookId,
          cookName: input.cookName,
          cookProvince: input.cookProvince,
          minOrderQty: input.minOrderQty,
          maxOrderQty: input.maxOrderQty,
          leadTime: input.leadTime,
          cancellationAllowed: input.cancellationAllowed,
        },
        input.item,
      );
      return { conflict: false };
    },
    [cook, items.length, upsert],
  );

  const clearAndAdd = useCallback(
    (input: AddItemInput) => {
      setItems([]);
      setNotesState(null);
      setDeliveryDetailsState(null);
      upsert(
        {
          cookId: input.cookId,
          cookName: input.cookName,
          cookProvince: input.cookProvince,
          minOrderQty: input.minOrderQty,
          maxOrderQty: input.maxOrderQty,
          leadTime: input.leadTime,
          cancellationAllowed: input.cancellationAllowed,
        },
        input.item,
      );
    },
    [upsert],
  );

  const removeItem = useCallback((dishId: string) => {
    setItems((prev) => prev.filter((i) => i.dishId !== dishId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCook(null);
    setDeliveryAddressState(null);
    setNotesState(null);
    setDeliveryDetailsState(null);
  }, []);

  const totalQuantity = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );
  const subtotal = useMemo(
    () =>
      Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100,
    [items],
  );

  const minOrderQty = cook?.minOrderQty ?? 1;
  const maxOrderQty = cook?.maxOrderQty ?? null;
  const meetsMinimum = totalQuantity >= minOrderQty;
  const withinMaximum = maxOrderQty == null || totalQuantity <= maxOrderQty;

  const value: CartContextType = {
    cookId: cook?.cookId ?? null,
    cookName: cook?.cookName ?? null,
    cookProvince: cook?.cookProvince ?? "ON",
    minOrderQty,
    maxOrderQty,
    leadTime: cook?.leadTime ?? null,
    cancellationAllowed: cook?.cancellationAllowed ?? false,
    items,
    fulfillmentMode,
    deliveryAddress,
    notes,
    deliveryDetails,
    totalQuantity,
    subtotal,
    meetsMinimum,
    withinMaximum,
    addItem,
    clearAndAdd,
    removeItem,
    clearCart,
    setFulfillment: (mode: "pickup" | "delivery") => {
      setFulfillmentMode(mode);
      if (mode === "pickup") setDeliveryDetailsState(null);
    },
    setDeliveryAddress: setDeliveryAddressState,
    setNotes: setNotesState,
    setDeliveryDetails: setDeliveryDetailsState,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Build a CartItem with discount + line total from a dish + optional promo. */
export function buildCartItem(
  dish: { id: string; name: string; price: number },
  quantity: number,
  promo: {
    id: string;
    type: "percentage_off" | "fixed_off";
    value: number;
  } | null,
): CartItem {
  const { discountAmount, lineTotal } = computeLineTotal(
    dish.price,
    quantity,
    promo,
  );
  return {
    dishId: dish.id,
    name: dish.name,
    price: dish.price,
    quantity,
    promotionId: promo?.id ?? null,
    discountAmount,
    lineTotal,
  };
}
