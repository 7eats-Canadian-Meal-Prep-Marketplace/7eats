import dynamic from "next/dynamic";
import type {
  AddressAutocompleteErrors,
  AddressAutocompleteProps,
} from "./_component";

export type { AddressAutocompleteErrors, AddressAutocompleteProps };

export const AddressAutocomplete = dynamic(
  () =>
    import("./_component").then((m) => ({ default: m.AddressAutocomplete })),
  { ssr: false },
);
