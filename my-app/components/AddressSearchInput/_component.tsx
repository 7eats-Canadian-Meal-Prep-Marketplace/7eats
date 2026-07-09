"use client";
import { AddressAutofill } from "@mapbox/search-js-react";
import * as Sentry from "@sentry/nextjs";
import { type ComponentProps, useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!token) {
      Sentry.captureMessage(
        "NEXT_PUBLIC_MAPBOX_TOKEN is not configured — address autocomplete degraded to manual entry",
        "error",
      );
    }
  }, [token]);

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Keep Enter from submitting a parent form while picking an address.
    if (e.key === "Enter") e.preventDefault();
  }

  // Without a token, AddressAutofill can't initialize. Fall back to a plain
  // input so the page still works (manual entry, no suggestions) instead of
  // crashing — this component has no error boundary above it on /app.
  if (!token) {
    return (
      <input
        id={id}
        type="text"
        name="address-line1"
        autoComplete="address-line1"
        placeholder={placeholder}
        className={className}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <div style={{ width: "100%" }}>
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
          onKeyDown={handleKeyDown}
        />
      </AddressAutofill>
    </div>
  );
}
