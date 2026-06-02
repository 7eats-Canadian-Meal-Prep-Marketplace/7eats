"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type FulfillmentMode = "pickup" | "delivery";

type AppContextType = {
  isLoggedIn: boolean;
  fulfillment: FulfillmentMode;
  setFulfillment: (m: FulfillmentMode) => void;
};

const AppContext = createContext<AppContextType | null>(null);

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({
  isLoggedIn,
  children,
}: {
  isLoggedIn: boolean;
  children: React.ReactNode;
}) {
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>("pickup");

  const value = useMemo(
    () => ({ isLoggedIn, fulfillment, setFulfillment }),
    [isLoggedIn, fulfillment],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
