export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cumulative distance (m) at each vertex of a polyline. */
export function cumulativeDistances(path: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + haversine(path[i - 1], path[i]));
  return out;
}

/** Point at `distance` metres along the path (clamped to the ends). */
export function pointAlong(path: LatLng[], cumulative: number[], distance: number): LatLng {
  const total = cumulative[cumulative.length - 1];
  const d = Math.max(0, Math.min(total, distance));
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < d) i++;
  const segLen = cumulative[i] - cumulative[i - 1] || 1;
  const t = (d - cumulative[i - 1]) / segLen;
  return {
    lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
    lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
  };
}

/** Compass bearing in degrees (0 = north) from a to b — used to rotate bus icons. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Project a point onto the polyline and return how far along it lies (m).
 * Uses an equirectangular approximation per segment, which is accurate to
 * centimetres at city scale.
 */
export function distanceAlong(path: LatLng[], cumulative: number[], p: LatLng): { along: number; offset: number } {
  let best = { along: 0, offset: Infinity };
  const k = Math.cos(toRad(p.lat));
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const ax = a.lng * k, ay = a.lat, bx = b.lng * k, by = b.lat, px = p.lng * k, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const proj = { lat: ay + dy * t, lng: (ax + dx * t) / k };
    const offset = haversine(p, proj);
    if (offset < best.offset) {
      best = { along: cumulative[i - 1] + (cumulative[i] - cumulative[i - 1]) * t, offset };
    }
  }
  return best;
}
