// Server-side only — uses MAPBOX_SECRET_TOKEN

export type GeoPoint = { lat: number; lng: number };

export async function geocodeAddress(
  address: string,
): Promise<GeoPoint | null> {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) throw new Error("MAPBOX_SECRET_TOKEN is not configured");

  const encoded = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?country=CA&limit=1&access_token=${token}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Mapbox Geocoding error: ${res.status}`);

  const data = (await res.json()) as {
    features?: Array<{ center: [number, number] }>;
  };

  const feature = data.features?.[0];
  if (!feature) return null;

  const [lng, lat] = feature.center;
  return { lat, lng };
}
