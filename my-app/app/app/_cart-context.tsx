"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

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
  minOrderQty: number;
  maxOrderQty: number | null;
  item: CartItem;
};

type CartContextType = {
  cookId: string | null;
  cookName: string | null;
  minOrderQty: number;
  maxOrderQty: number | null;
  items: CartItem[];
  fulfillmentMode: "pickup" | "delivery";
  pickupAt: string | null;
  deliveryAddress: DeliveryAddress | null;
  notes: string | null;
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
  setQuantity: (dishId: string, quantity: number) => void;
  removeItem: (dishId: string) => void;
  clearCart: () => void;
  setFulfillment: (mode: "pickup" | "delivery") => void;
  setPickupAt: (iso: string | null) => void;
  setDeliveryAddress: (addr: DeliveryAddress | null) => void;
  setNotes: (notes: string | null) => void;
};

const CartContext = createContext<CartContextType | null>(null);

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

type CookMeta = {
  cookId: string;
  cookName: string;
  minOrderQty: number;
  maxOrderQty: number | null;
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cook, setCook] = useState<CookMeta | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [fulfillmentMode, setFulfillmentMode] = useState<"pickup" | "delivery">(
    "pickup",
  );
  const [pickupAt, setPickupAtState] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddressState] =
    useState<DeliveryAddress | null>(null);
  const [notes, setNotesState] = useState<string | null>(null);

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
      upsert(
        {
          cookId: input.cookId,
          cookName: input.cookName,
          minOrderQty: input.minOrderQty,
          maxOrderQty: input.maxOrderQty,
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
      upsert(
        {
          cookId: input.cookId,
          cookName: input.cookName,
          minOrderQty: input.minOrderQty,
          maxOrderQty: input.maxOrderQty,
        },
        input.item,
      );
    },
    [upsert],
  );

  const setQuantity = useCallback((dishId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.dishId === dishId ? recomputeLine({ ...i, quantity }) : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((dishId: string) => {
    setItems((prev) => prev.filter((i) => i.dishId !== dishId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCook(null);
    setDeliveryAddressState(null);
    setPickupAtState(null);
    setNotesState(null);
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
    minOrderQty,
    maxOrderQty,
    items,
    fulfillmentMode,
    pickupAt,
    deliveryAddress,
    notes,
    totalQuantity,
    subtotal,
    meetsMinimum,
    withinMaximum,
    addItem,
    clearAndAdd,
    setQuantity,
    removeItem,
    clearCart,
    setFulfillment: setFulfillmentMode,
    setPickupAt: setPickupAtState,
    setDeliveryAddress: setDeliveryAddressState,
    setNotes: setNotesState,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Recompute discount + line total when quantity changes (promo value is fixed). */
function recomputeLine(item: CartItem): CartItem {
  const gross = item.price * item.quantity;
  // The per-unit discount rate is preserved from the original line.
  const unitDiscount =
    item.quantity > 0 ? item.discountAmount / Math.max(1, item.quantity) : 0;
  // discountAmount scales with quantity only for fixed-per-unit promos; for the
  // cart we keep the simple model of discount proportional to quantity.
  const discountAmount = Math.min(
    Math.round(unitDiscount * item.quantity * 100) / 100,
    gross,
  );
  return {
    ...item,
    lineTotal: Math.round((gross - discountAmount) * 100) / 100,
  };
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
  const gross = dish.price * quantity;
  let discountAmount = 0;
  if (promo) {
    discountAmount =
      promo.type === "percentage_off"
        ? (gross * promo.value) / 100
        : promo.value;
    discountAmount = Math.min(discountAmount, gross);
  }
  discountAmount = Math.round(discountAmount * 100) / 100;
  return {
    dishId: dish.id,
    name: dish.name,
    price: dish.price,
    quantity,
    promotionId: promo?.id ?? null,
    discountAmount,
    lineTotal: Math.round((gross - discountAmount) * 100) / 100,
  };
}
