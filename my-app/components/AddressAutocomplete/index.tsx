import dynamic from "next/dynamic";
import type { AddressAutocompleteProps } from "./_component";

export type { AddressAutocompleteProps };

export const AddressAutocomplete = dynamic(
  () =>
    import("./_component").then((m) => ({ default: m.AddressAutocomplete })),
  { ssr: false },
);
