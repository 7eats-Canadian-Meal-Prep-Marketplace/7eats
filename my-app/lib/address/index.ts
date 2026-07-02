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

/**
 * Compose a cook's pickup address for display to the client (order detail page,
 * checkout, and emails). Mirrors the delivery address order — street, unit,
 * city, province, postal — includes the unit (which `formatAddressLine` omits),
 * normalizes the province to a 2-letter code, and returns `null` when nothing
 * is present so callers can suppress an empty "Location" row.
 */
export function formatPickupLocation(parts: {
  street?: string | null;
  unit?: string | null;
  city?: string | null;
  province?: string | null;
  postal?: string | null;
}): string | null {
  const line = [
    parts.street,
    parts.unit,
    parts.city,
    parts.province ? normalizeProvinceCode(parts.province) : null,
    parts.postal,
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
  return line.length > 0 ? line : null;
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
