/**
 * Where 7eats is actively serving, and how to describe an address that falls
 * outside the cooks we can reach. Used by the browse/search empty states to turn
 * "no kitchens found" into a location-aware message.
 */

/** Canadian province/territory codes → display names. */
const CA_PROVINCES: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

/** Province where 7eats is live at launch — described at city granularity. */
export const ACTIVE_PROVINCE = "ON";

export type RegionStatus =
  // Inside the live province: name the city we're expanding toward.
  | { kind: "active-province"; place: string }
  // Elsewhere in Canada: name the province.
  | { kind: "other-province"; place: string }
  // Outside Canada: not serviceable at all.
  | { kind: "outside-canada" };

/**
 * Classify a service address for the empty state. `province` is the 2-char ISO
 * code stored on every resolved address (e.g. "ON", "BC"); Canada has no "CA"
 * code, so a US "CA"/"WA" state falls through to `outside-canada`.
 */
export function classifyRegion(addr: {
  city: string;
  province: string;
}): RegionStatus {
  const code = (addr.province || "").toUpperCase();
  if (!(code in CA_PROVINCES)) return { kind: "outside-canada" };
  if (code === ACTIVE_PROVINCE) {
    return { kind: "active-province", place: addr.city?.trim() || "your area" };
  }
  return { kind: "other-province", place: CA_PROVINCES[code] };
}
