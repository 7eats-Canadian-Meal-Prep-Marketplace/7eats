import dynamic from "next/dynamic";
import type { AddressSearchInputProps, ResolvedAddress } from "./_component";

export type { AddressSearchInputProps, ResolvedAddress };

export const AddressSearchInput = dynamic(
  () => import("./_component").then((m) => ({ default: m.AddressSearchInput })),
  { ssr: false },
);
