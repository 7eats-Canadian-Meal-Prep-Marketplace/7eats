"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type FulfillmentMode = "pickup" | "delivery";

type AppContextType = {
  isLoggedIn: boolean;
  userName: string;
  userEmail: string;
  fulfillment: FulfillmentMode;
  setFulfillment: (m: FulfillmentMode) => void;
  /** 2-char ISO province code from the user's saved address, e.g. "ON", "BC". */
  province: string;
  setProvince: (p: string) => void;
};

const AppContext = createContext<AppContextType | null>(null);

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({
  isLoggedIn,
  userName = "",
  userEmail = "",
  children,
}: {
  isLoggedIn: boolean;
  userName?: string;
  userEmail?: string;
  children: React.ReactNode;
}) {
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>("pickup");
  const [province, setProvince] = useState<string>("ON");

  const value = useMemo(
    () => ({
      isLoggedIn,
      userName,
      userEmail,
      fulfillment,
      setFulfillment,
      province,
      setProvince,
    }),
    [isLoggedIn, userName, userEmail, fulfillment, province],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
