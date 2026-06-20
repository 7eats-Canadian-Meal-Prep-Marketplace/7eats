import { SEARCH_MAX_QUERY_LEN } from "./config";

/**
 * Normalize a raw search query for matching: trim, collapse internal
 * whitespace, lower-case, and clamp length. Returns "" for empty/blank input so
 * callers can short-circuit. Pure + side-effect free so it can run on the
 * client (autocomplete debounce) and the server (query builder) identically.
 */
export function normalizeQuery(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, SEARCH_MAX_QUERY_LEN)
    .toLowerCase();
}

/** Bounding box (in degrees) around a point for a given radius in km. */
export function boundingBox(
  lat: number,
  lng: number,
  radiusKm: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusKm / 111; // ~111 km per degree latitude
  // Longitude degrees shrink with latitude; guard against cos -> 0 near poles.
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const lngDelta = radiusKm / (111 * cosLat);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}
