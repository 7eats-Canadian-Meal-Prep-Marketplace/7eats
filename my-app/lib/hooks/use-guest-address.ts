"use client";

import { useEffect, useState } from "react";

export type GuestAddress = {
  displayText: string;
  street: string;
  unit: string;
  city: string;
  province: string;
  postal: string;
  lat: number | null;
  lng: number | null;
};

const STORAGE_KEY = "7eats_guest_address";

export function useGuestAddress() {
  const [guestAddress, setGuestAddressState] = useState<GuestAddress | null>(
    null,
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setGuestAddressState(JSON.parse(stored) as GuestAddress);
    } catch {}
  }, []);

  function setGuestAddress(addr: GuestAddress | null) {
    if (addr === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(addr));
    }
    setGuestAddressState(addr);
  }

  return { guestAddress, setGuestAddress };
}
