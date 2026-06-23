"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type FulfillmentMode = "pickup" | "delivery";

type AppContextType = {
  isLoggedIn: boolean;
  userName: string;
  setUserName: (name: string) => void;
  userEmail: string;
  userInitials: string;
  setUserInitials: (initials: string) => void;
  userImage: string | null;
  setUserImage: (url: string | null) => void;
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
  userName: initialUserName = "",
  userEmail = "",
  userInitials: initialUserInitials = "?",
  userImage: initialUserImage = null,
  children,
}: {
  isLoggedIn: boolean;
  userName?: string;
  userEmail?: string;
  userInitials?: string;
  userImage?: string | null;
  children: React.ReactNode;
}) {
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>("pickup");
  const [province, setProvince] = useState<string>("ON");
  const [userName, setUserName] = useState(initialUserName);
  const [userInitials, setUserInitials] = useState(initialUserInitials);
  const [userImage, setUserImageState] = useState<string | null>(
    initialUserImage,
  );

  const setUserImage = useCallback((url: string | null) => {
    setUserImageState(url);
  }, []);

  const value = useMemo(
    () => ({
      isLoggedIn,
      userName,
      setUserName,
      userEmail,
      userInitials,
      setUserInitials,
      userImage,
      setUserImage,
      fulfillment,
      setFulfillment,
      province,
      setProvince,
    }),
    [
      isLoggedIn,
      userName,
      userEmail,
      userInitials,
      userImage,
      setUserImage,
      fulfillment,
      province,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
