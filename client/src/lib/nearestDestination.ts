/**
 * Helpers for the "Show Me What's Nearby" flow:
 *  - nearest destination across ALL destinations that have coordinates
 *  - device position kept in sessionStorage so the destination page can use it
 *    as the distance reference for Explore Nearby results (tab-session only).
 */

export interface LatLng { lat: number; lng: number }

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function findNearestDestination<T extends { slug: string; lat: number; lng: number }>(
  dests: T[],
  pos: LatLng,
): { dest: T; distM: number } | null {
  let best: { dest: T; distM: number } | null = null;
  for (const d of dests) {
    if (typeof d.lat !== "number" || typeof d.lng !== "number" || (!d.lat && !d.lng)) continue;
    const distM = haversineM(pos.lat, pos.lng, d.lat, d.lng);
    if (!best || distM < best.distM) best = { dest: d, distM };
  }
  return best;
}

const POS_KEY = "alb_user_pos";
const POS_MAX_AGE_MS = 30 * 60_000;

export function saveUserPosition(pos: LatLng): void {
  try { sessionStorage.setItem(POS_KEY, JSON.stringify({ ...pos, ts: Date.now() })); } catch {}
}

/** Returns the device position saved this session (max 30 min old), or null. */
export function getSavedUserPosition(): LatLng | null {
  try {
    const raw = sessionStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.lat !== "number" || typeof p.lng !== "number") return null;
    if (Date.now() - (p.ts || 0) > POS_MAX_AGE_MS) return null;
    return { lat: p.lat, lng: p.lng };
  } catch { return null; }
}

export function formatKm(distM: number): string {
  const km = distM / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

/** Destinations farther than this from the device trigger the "far away" confirmation. */
export const FAR_THRESHOLD_M = 100_000;
