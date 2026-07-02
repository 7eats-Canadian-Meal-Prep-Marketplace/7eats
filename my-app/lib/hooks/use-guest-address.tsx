"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type GuestAddress = {
  id: string;
  street: string;
  unit: string;
  city: string;
  province: string;
  postal: string;
  lat: number;
  lng: number;
  placeId: string;
};

type GuestAddressStore = {
  addresses: GuestAddress[];
  selectedId: string | null;
};

const STORAGE_KEY = "7eats_guest_addresses";
const LEGACY_KEY = "7eats_guest_address";

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `addr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function readStore(): GuestAddressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GuestAddressStore;
      if (Array.isArray(parsed.addresses)) return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Partial<GuestAddress> & {
        lat?: number | null;
        lng?: number | null;
      };
      if (old?.lat != null && old?.lng != null) {
        const migrated: GuestAddress = {
          id: newId(),
          street: old.street ?? "",
          unit: old.unit ?? "",
          city: old.city ?? "",
          province: old.province ?? "ON",
          postal: old.postal ?? "",
          lat: old.lat,
          lng: old.lng,
          placeId: old.placeId ?? "",
        };
        return { addresses: [migrated], selectedId: migrated.id };
      }
    }
  } catch {}
  return { addresses: [], selectedId: null };
}

function writeStore(store: GuestAddressStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

function addressDedupeKey(addr: {
  placeId: string;
  street: string;
  postal: string;
  lat: number;
  lng: number;
}): string {
  const place = addr.placeId.trim();
  if (place) return `place:${place}`;
  const street = addr.street.trim().toLowerCase();
  const postal = addr.postal.trim().toLowerCase().replace(/\s/g, "");
  return `manual:${street}|${postal}|${addr.lat.toFixed(5)}|${addr.lng.toFixed(5)}`;
}

function findExistingAddress(
  addresses: GuestAddress[],
  addr: Omit<GuestAddress, "id">,
): GuestAddress | undefined {
  const key = addressDedupeKey(addr);
  return addresses.find((a) => addressDedupeKey(a) === key);
}

export function addressesMatch(
  a: {
    placeId: string;
    street: string;
    postal: string;
    lat: number;
    lng: number;
  },
  b: {
    placeId: string;
    street: string;
    postal: string;
    lat: number;
    lng: number;
  },
): boolean {
  return addressDedupeKey(a) === addressDedupeKey(b);
}

type GuestAddressContextValue = {
  hydrated: boolean;
  addresses: GuestAddress[];
  selected: GuestAddress | null;
  selectedAddress: GuestAddress | null;
  addAddress: (addr: Omit<GuestAddress, "id">) => GuestAddress;
  selectAddress: (id: string) => void;
  removeAddress: (id: string) => void;
};

const GuestAddressContext = createContext<GuestAddressContextValue | null>(
  null,
);

export function GuestAddressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [store, setStore] = useState<GuestAddressStore>({
    addresses: [],
    selectedId: null,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStore(readStore());
    setHydrated(true);
  }, []);

  const addAddress = useCallback(
    (addr: Omit<GuestAddress, "id">): GuestAddress => {
      const prev = readStore();
      const existing = findExistingAddress(prev.addresses, addr);
      if (existing) {
        const next = { ...prev, selectedId: existing.id };
        writeStore(next);
        setStore(next);
        return existing;
      }
      const created: GuestAddress = { ...addr, id: newId() };
      const next = {
        addresses: [...prev.addresses, created],
        selectedId: created.id,
      };
      writeStore(next);
      setStore(next);
      return created;
    },
    [],
  );

  const selectAddress = useCallback((id: string) => {
    setStore((prev) => {
      if (!prev.addresses.some((a) => a.id === id)) return prev;
      const next = { ...prev, selectedId: id };
      writeStore(next);
      return next;
    });
  }, []);

  const removeAddress = useCallback((id: string) => {
    setStore((prev) => {
      if (prev.addresses.length <= 1) return prev;
      const addresses = prev.addresses.filter((a) => a.id !== id);
      const selectedId =
        prev.selectedId === id ? addresses[0].id : prev.selectedId;
      const next = { addresses, selectedId };
      writeStore(next);
      return next;
    });
  }, []);

  const selected =
    store.addresses.find((a) => a.id === store.selectedId) ??
    store.addresses[0] ??
    null;

  const value = useMemo(
    () => ({
      hydrated,
      addresses: store.addresses,
      selected,
      selectedAddress: selected,
      addAddress,
      selectAddress,
      removeAddress,
    }),
    [
      hydrated,
      store.addresses,
      selected,
      addAddress,
      selectAddress,
      removeAddress,
    ],
  );

  return createElement(GuestAddressContext.Provider, { value }, children);
}

export function useGuestAddress(): GuestAddressContextValue {
  const ctx = useContext(GuestAddressContext);
  if (!ctx) {
    throw new Error("useGuestAddress must be used within GuestAddressProvider");
  }
  return ctx;
}
