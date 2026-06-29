// Server-side only — uses MAPBOX_SECRET_TOKEN
const DIRECTIONS_BASE = "https://api.mapbox.com/directions/v5/mapbox/driving";

export async function getDrivingDistanceKm(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<number> {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) throw new Error("MAPBOX_SECRET_TOKEN is not configured");

  const url = `${DIRECTIONS_BASE}/${originLng},${originLat};${destLng},${destLat}?access_token=${token}&overview=false&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox Directions API error: ${res.status}`);

  const data = await res.json();
  const routeDistanceMeters: number = data.routes?.[0]?.distance;
  if (routeDistanceMeters == null)
    throw new Error("No route found between the two points");

  return routeDistanceMeters / 1000;
}
