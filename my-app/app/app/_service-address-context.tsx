"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useGuestAddress } from "@/lib/hooks/use-guest-address";
import type { NormalizedAddress } from "@/lib/types/address";
import { useApp } from "./_app-context";

type ServiceAddressContextValue = {
  ready: boolean;
  currentAddress: NormalizedAddress | null;
  /** Stable key for refetching cook lists when the service location changes. */
  coordsKey: string | null;
  setServerAddress: (address: NormalizedAddress | null) => void;
};

const ServiceAddressContext = createContext<ServiceAddressContextValue | null>(
  null,
);

function guestToNormalized(guest: {
  street: string;
  unit: string;
  city: string;
  province: string;
  postal: string;
  lat: number;
  lng: number;
  placeId: string;
}): NormalizedAddress {
  return {
    street: guest.street,
    unit: guest.unit || undefined,
    city: guest.city,
    province: guest.province,
    postal: guest.postal,
    lat: guest.lat,
    lng: guest.lng,
    placeId: guest.placeId,
  };
}

export function ServiceAddressProvider({
  isLoggedIn,
  children,
}: {
  isLoggedIn: boolean;
  children: React.ReactNode;
}) {
  const guest = useGuestAddress();
  const { setProvince } = useApp();
  const [serverAddress, setServerAddress] = useState<NormalizedAddress | null>(
    null,
  );
  const [serverLoaded, setServerLoaded] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setServerLoaded(true);
      return;
    }
    fetch("/api/user/address")
      .then((res) => res.json())
      .then((data) => {
        if (data.address) {
          const normalized = data.address as NormalizedAddress;
          setServerAddress(normalized);
          setProvince(normalized.province);
        }
      })
      .catch(() => {})
      .finally(() => setServerLoaded(true));
  }, [isLoggedIn, setProvince]);

  useEffect(() => {
    if (isLoggedIn) {
      if (serverAddress) setProvince(serverAddress.province);
      return;
    }
    if (guest.selected) setProvince(guest.selected.province);
  }, [isLoggedIn, guest.selected, serverAddress, setProvince]);

  const ready = isLoggedIn ? serverLoaded : guest.hydrated;

  const currentAddress: NormalizedAddress | null = isLoggedIn
    ? serverAddress
    : guest.selected
      ? guestToNormalized(guest.selected)
      : null;

  const coordsKey = currentAddress
    ? `${currentAddress.lat.toFixed(6)},${currentAddress.lng.toFixed(6)}`
    : null;

  const value = useMemo(
    () => ({
      ready,
      currentAddress,
      coordsKey,
      setServerAddress,
    }),
    [ready, currentAddress, coordsKey],
  );

  return (
    <ServiceAddressContext.Provider value={value}>
      {children}
    </ServiceAddressContext.Provider>
  );
}

export function useServiceAddress(): ServiceAddressContextValue {
  const ctx = useContext(ServiceAddressContext);
  if (!ctx) {
    throw new Error(
      "useServiceAddress must be used within ServiceAddressProvider",
    );
  }
  return ctx;
}
