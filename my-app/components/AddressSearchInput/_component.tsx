"use client";
import { AddressAutofill } from "@mapbox/search-js-react";
import { type ComponentProps, useRef } from "react";
import { normalizeProvinceCode } from "@/lib/address";

type AddressAutofillProps = ComponentProps<typeof AddressAutofill>;
type AddressAutofillRetrieveResponse = NonNullable<
  Parameters<NonNullable<AddressAutofillProps["onRetrieve"]>>[0]
>;

/** A fully-resolved address — only produced when a Mapbox suggestion is picked. */
export interface ResolvedAddress {
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  lat: number;
  lng: number;
  placeId: string;
}

export interface AddressSearchInputProps {
  /** Controlled street-line text shown in the single input. */
  value: string;
  /**
   * Manual keystrokes. The previous selection is no longer valid until the user
   * picks a fresh suggestion, so the host should treat the address as unresolved.
   */
  onTextChange: (text: string) => void;
  /** A suggestion was chosen from the Mapbox dropdown. */
  onResolve: (address: ResolvedAddress) => void;
  id?: string;
  className?: string;
  placeholder?: string;
}

export function AddressSearchInput({
  value,
  onTextChange,
  onResolve,
  id = "address-search",
  className = "",
  placeholder = "Start typing your address…",
}: AddressSearchInputProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN is not configured");

  // Street line of the most recently selected suggestion. Right after onRetrieve,
  // AddressAutofill echoes a native change event carrying just this line; we use
  // this ref to tell that echo apart from a genuine manual edit (which would
  // otherwise invalidate the pick the user just made).
  const resolvedStreet = useRef("");

  function handleRetrieve(res: AddressAutofillRetrieveResponse) {
    const feature = res.features[0];
    if (!feature) return;
    const { properties, geometry } = feature;
    const coords = geometry.coordinates as [number, number];
    const street = properties.address_line1 ?? "";
    resolvedStreet.current = street;
    const rawProvince = properties.address_level1 ?? "";
    onResolve({
      streetAddress: street,
      city: properties.address_level2 ?? "",
      province: normalizeProvinceCode(rawProvince),
      postalCode: properties.postcode ?? "",
      lat: coords[1],
      lng: coords[0],
      placeId: properties.mapbox_id ?? "",
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    // Ignore the post-retrieve echo that re-sends the just-selected street line.
    // Guard on a non-empty resolved street so clearing the input back to "" isn't
    // mistaken for the echo (which would otherwise trap the last character).
    if (resolvedStreet.current && v === resolvedStreet.current) return;
    resolvedStreet.current = "";
    onTextChange(v);
  }

  return (
    // Nested in its own form so AddressAutofill can enable address autocomplete
    // and Enter doesn't submit the surrounding application form.
    <form onSubmit={(e) => e.preventDefault()} style={{ display: "contents" }}>
      <AddressAutofill
        accessToken={token}
        options={{ country: "ca", language: "en" }}
        onRetrieve={handleRetrieve}
      >
        <input
          id={id}
          type="text"
          name="address-line1"
          autoComplete="address-line1"
          placeholder={placeholder}
          className={className}
          value={value}
          onChange={handleChange}
        />
      </AddressAutofill>
    </form>
  );
}
