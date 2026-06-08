"use client";
import { AddressAutofill } from "@mapbox/search-js-react";
import type { ComponentProps } from "react";
import { useState } from "react";
import type { NormalizedAddress } from "@/lib/types/address";

type AddressAutofillProps = ComponentProps<typeof AddressAutofill>;
type AddressAutofillRetrieveResponse = NonNullable<
  Parameters<NonNullable<AddressAutofillProps["onRetrieve"]>>[0]
>;

interface Props {
  onResolve: (address: NormalizedAddress) => void;
  initialValue?: string;
  placeholder?: string;
  inputClassName?: string;
  name?: string;
}

export function AddressAutocomplete({
  onResolve,
  initialValue = "",
  placeholder = "Start typing your address…",
  inputClassName = "",
  name = "address",
}: Props) {
  const [value, setValue] = useState(initialValue);

  function handleRetrieve(res: AddressAutofillRetrieveResponse) {
    const feature = res.features[0];
    if (!feature) return;
    const { properties, geometry } = feature;
    // geometry.coordinates is GeoJSON Position (number[]) — lng first, lat second
    const coords = geometry.coordinates as [number, number];
    const resolved: NormalizedAddress = {
      street: properties.address_line1 ?? "",
      unit: properties.address_line2 || undefined,
      // address_level2 = city, address_level1 = province/state
      city: properties.address_level2 ?? "",
      province: properties.address_level1 ?? "",
      postal: properties.postcode ?? "",
      lat: coords[1],
      lng: coords[0],
      placeId: properties.mapbox_id ?? "",
    };
    onResolve(resolved);
    setValue(properties.full_address ?? properties.address_line1 ?? "");
  }

  return (
    <AddressAutofill
      accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN!}
      options={{ country: "ca", language: "en" }}
      onRetrieve={handleRetrieve}
    >
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="address-line1"
        className={inputClassName}
      />
    </AddressAutofill>
  );
}
