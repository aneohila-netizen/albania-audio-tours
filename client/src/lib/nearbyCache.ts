/**
 * Small in-memory cache for /api/nearby responses (Google Places proxy).
 *  - dedupes in-flight requests (prefetch + panel open share one call)
 *  - 10 minute TTL, successful responses only (errors / "not configured" are never cached)
 * Keeps Google Places usage down: the same destination + category is fetched once per
 * visit, and switching tabs back and forth is instant.
 */
import { RAILWAY_URL } from "@/lib/queryClient";

const TTL_MS = 10 * 60_000;
const store = new Map<string, { at: number; promise: Promise<any> }>();

const keyOf = (lat: number, lng: number, type: string) => `${lat.toFixed(4)},${lng.toFixed(4)},${type}`;

export function getNearby<T = any>(lat: number, lng: number, type: string, force = false): Promise<T> {
  const key = keyOf(lat, lng, type);
  const hit = store.get(key);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.promise as Promise<T>;

  const promise = fetch(`${RAILWAY_URL}/api/nearby`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, type }),
  })
    .then(r => r.json())
    .then((data: any) => {
      // Do not keep failures or unconfigured responses around
      if (data?.error || data?.configured === false) store.delete(key);
      return data as T;
    })
    .catch(err => { store.delete(key); throw err; });

  store.set(key, { at: Date.now(), promise });
  return promise;
}

/** Fire-and-forget warm-up; never throws. */
export function prefetchNearby(lat: number, lng: number, type: string): void {
  getNearby(lat, lng, type).catch(() => {});
}
