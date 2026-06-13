"use client";
import { AddressAutofill } from "@mapbox/search-js-react";
import type { ComponentProps } from "react";
import { useState } from "react";
import type { NormalizedAddress } from "@/lib/types/address";

type AddressAutofillProps = ComponentProps<typeof AddressAutofill>;
type AddressAutofillRetrieveResponse = NonNullable<
  Parameters<NonNullable<AddressAutofillProps["onRetrieve"]>>[0]
>;

const PROVINCE_NAME_TO_CODE: Record<string, string> = {
  Alberta: "AB",
  "British Columbia": "BC",
  Manitoba: "MB",
  "New Brunswick": "NB",
  "Newfoundland and Labrador": "NL",
  "Northwest Territories": "NT",
  "Nova Scotia": "NS",
  Nunavut: "NU",
  Ontario: "ON",
  "Prince Edward Island": "PE",
  Quebec: "QC",
  Saskatchewan: "SK",
  Yukon: "YT",
};

export interface AddressAutocompleteProps {
  onResolve: (address: NormalizedAddress) => void;
  initialValue?: string;
  placeholder?: string;
  inputClassName?: string;
  name?: string;
  id?: string;
}

export function AddressAutocomplete({
  onResolve,
  initialValue = "",
  placeholder = "Start typing your address…",
  inputClassName = "",
  name = "address",
  id,
}: AddressAutocompleteProps) {
  const [value, setValue] = useState(initialValue);

  function handleRetrieve(res: AddressAutofillRetrieveResponse) {
    const feature = res.features[0];
    if (!feature) return;
    const { properties, geometry } = feature;
    const coords = geometry.coordinates as [number, number];
    const rawProvince = properties.address_level1 ?? "";
    const province = PROVINCE_NAME_TO_CODE[rawProvince] ?? rawProvince;
    const resolved: NormalizedAddress = {
      street: properties.address_line1 ?? "",
      unit: properties.address_line2 || undefined,
      city: properties.address_level2 ?? "",
      province,
      postal: properties.postcode ?? "",
      lat: coords[1],
      lng: coords[0],
      placeId: properties.mapbox_id ?? "",
    };
    onResolve(resolved);
    setValue(properties.full_address ?? properties.address_line1 ?? "");
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN is not configured");

  return (
    <form onSubmit={(e) => e.preventDefault()} style={{ display: "contents" }}>
      <AddressAutofill
        accessToken={token}
        options={{ country: "ca", language: "en" }}
        onRetrieve={handleRetrieve}
      >
        <input
          id={id}
          type="text"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="address-line1"
          className={inputClassName}
        />
      </AddressAutofill>
    </form>
  );
}
