"use client";

import { createContext, useContext } from "react";

export type HostInfo = {
  firstName: string;
  lastName: string;
};

const HostContext = createContext<HostInfo>({ firstName: "", lastName: "" });

export const HostProvider = HostContext.Provider;

export function useHost(): HostInfo {
  return useContext(HostContext);
}
