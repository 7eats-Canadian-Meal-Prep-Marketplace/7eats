"use client";
import { AddressAutofill } from "@mapbox/search-js-react";
import type { ComponentProps } from "react";
import type { NormalizedAddress } from "@/lib/types/address";
import styles from "./_component.module.css";

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

const PROVINCES: { code: string; label: string }[] = [
  { code: "AB", label: "Alberta" },
  { code: "BC", label: "British Columbia" },
  { code: "MB", label: "Manitoba" },
  { code: "NB", label: "New Brunswick" },
  { code: "NL", label: "Newfoundland and Labrador" },
  { code: "NS", label: "Nova Scotia" },
  { code: "NT", label: "Northwest Territories" },
  { code: "NU", label: "Nunavut" },
  { code: "ON", label: "Ontario" },
  { code: "PE", label: "Prince Edward Island" },
  { code: "QC", label: "Quebec" },
  { code: "SK", label: "Saskatchewan" },
  { code: "YT", label: "Yukon" },
];

export interface AddressAutocompleteErrors {
  street?: string;
  city?: string;
  province?: string;
  postal?: string;
}

export interface AddressAutocompleteProps {
  /** Controlled address value. Fields not yet resolved may be omitted. */
  value: Partial<NormalizedAddress>;
  /** Called with the full merged address whenever any field changes. */
  onChange: (address: Partial<NormalizedAddress>) => void;
  errors?: AddressAutocompleteErrors;
  /** Prefix for field ids, in case multiple instances render on one page. */
  idPrefix?: string;
  /** Extra class applied to every input/select, to match the host page's form styling. */
  inputClassName?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  errors,
  idPrefix = "address",
  inputClassName = "",
}: AddressAutocompleteProps) {
  function handleRetrieve(res: AddressAutofillRetrieveResponse) {
    const feature = res.features[0];
    if (!feature) return;
    const { properties, geometry } = feature;
    const coords = geometry.coordinates as [number, number];
    const rawProvince = properties.address_level1 ?? "";
    const province = PROVINCE_NAME_TO_CODE[rawProvince] ?? rawProvince;
    onChange({
      street: properties.address_line1 ?? "",
      unit: properties.address_line2 || undefined,
      city: properties.address_level2 ?? "",
      province,
      postal: properties.postcode ?? "",
      lat: coords[1],
      lng: coords[0],
      placeId: properties.mapbox_id ?? "",
    });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN is not configured");

  const inputCls = `${styles.input} ${inputClassName}`.trim();

  return (
    <>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-street`} className={styles.label}>
          Street address
        </label>
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{ display: "contents" }}
        >
          <AddressAutofill
            accessToken={token}
            options={{ country: "ca", language: "en" }}
            onRetrieve={handleRetrieve}
          >
            <input
              id={`${idPrefix}-street`}
              type="text"
              name="address-line1"
              autoComplete="address-line1"
              placeholder="Start typing your address…"
              className={inputCls}
              value={value.street ?? ""}
              onChange={(e) => onChange({ ...value, street: e.target.value })}
            />
          </AddressAutofill>
        </form>
        {errors?.street && <p className={styles.error}>{errors.street}</p>}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-unit`} className={styles.label}>
            Apt / Unit <span className={styles.optional}>(optional)</span>
          </label>
          <input
            id={`${idPrefix}-unit`}
            type="text"
            name="address-line2"
            autoComplete="address-line2"
            className={inputCls}
            value={value.unit ?? ""}
            onChange={(e) => onChange({ ...value, unit: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-postal`} className={styles.label}>
            Postal code
          </label>
          <input
            id={`${idPrefix}-postal`}
            type="text"
            name="postal-code"
            autoComplete="postal-code"
            className={inputCls}
            value={value.postal ?? ""}
            onChange={(e) => onChange({ ...value, postal: e.target.value })}
          />
          {errors?.postal && <p className={styles.error}>{errors.postal}</p>}
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-city`} className={styles.label}>
            City
          </label>
          <input
            id={`${idPrefix}-city`}
            type="text"
            name="address-level2"
            autoComplete="address-level2"
            className={inputCls}
            value={value.city ?? ""}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
          />
          {errors?.city && <p className={styles.error}>{errors.city}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-province`} className={styles.label}>
            Province
          </label>
          <select
            id={`${idPrefix}-province`}
            name="address-level1"
            autoComplete="address-level1"
            className={inputCls}
            value={value.province ?? ""}
            onChange={(e) => onChange({ ...value, province: e.target.value })}
          >
            <option value="" disabled>
              Select…
            </option>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
          {errors?.province && (
            <p className={styles.error}>{errors.province}</p>
          )}
        </div>
      </div>
    </>
  );
}
