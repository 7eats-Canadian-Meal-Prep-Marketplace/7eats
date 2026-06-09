export interface NormalizedAddress {
  street: string;
  unit?: string;
  city: string;
  province: string; // 2-char ISO, e.g. "ON"
  postal: string;
  lat: number;
  lng: number;
  placeId: string; // Mapbox mapbox_id — used for distance caching
}
