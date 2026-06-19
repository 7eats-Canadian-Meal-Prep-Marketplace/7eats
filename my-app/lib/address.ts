export const PROVINCE_NAME_TO_CODE: Record<string, string> = {
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

export function normalizeProvinceCode(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return PROVINCE_NAME_TO_CODE[trimmed] ?? trimmed;
}

export function formatAddressLine(parts: {
  street?: string | null;
  city?: string | null;
  province?: string | null;
  postal?: string | null;
}): string {
  return [
    parts.street,
    parts.city,
    normalizeProvinceCode(parts.province ?? ""),
    parts.postal,
  ]
    .filter(Boolean)
    .join(", ");
}

export function isGeocodedPickupAddress(input: {
  pickupStreet: string;
  pickupCity: string;
  pickupProvince: string;
  pickupPostal: string;
  pickupLat: number | null;
  pickupLng: number | null;
}): boolean {
  const province = normalizeProvinceCode(input.pickupProvince);
  return (
    input.pickupStreet.trim().length > 0 &&
    input.pickupCity.trim().length > 0 &&
    province.length === 2 &&
    input.pickupPostal.trim().length >= 3 &&
    input.pickupLat != null &&
    input.pickupLng != null
  );
}
