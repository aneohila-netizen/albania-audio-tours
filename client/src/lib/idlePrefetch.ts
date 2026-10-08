/**
 * Idle prefetching — once the landing page is usable and the browser is idle, quietly warm what
 * the visitor is most likely to open next, so later page changes feel instant.
 *
 *  - page code (Tour Sites, Destination)                       ~ a few KB each
 *  - destination detail for the nearest destination (if the device location is known this
 *    session) and for the two destinations with the most attractions (a proxy for "popular")
 *  - attractions of the nearest destination only
 *
 * Guardrails: skipped entirely on Save-Data / 2G; code only on 3G; nothing while the tab is hidden;
 * one request at a time, each in a browser idle slot; cancelled as soon as the visitor navigates
 * away. Audio files and Google Places results are NEVER prefetched here (large / billed).
 */
import { prefetchDestination, prefetchSite } from "./useApiData";
import { findNearestDestination, getSavedUserPosition } from "./nearestDestination";

type Tier = "off" | "code" | "full";

export function prefetchTier(): Tier {
  const c = (navigator as any).connection as { saveData?: boolean; effectiveType?: string } | undefined;
  if (!c) return "full";
  if (c.saveData) return "off";
  if (c.effectiveType === "slow-2g" || c.effectiveType === "2g") return "off";
  if (c.effectiveType === "3g") return "code";
  return "full";
}

const idle = (timeout = 2000) =>
  new Promise<void>(resolve => {
    const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
    if (ric) ric(() => resolve(), { timeout });
    else setTimeout(resolve, 150);
  });

export interface PrefetchInput {
  destinations: Array<{ slug: string; lat: number; lng: number }>;
  attractions: Array<{ destinationSlug: string }>;
}

/** Starts the sequence; returns a cancel function. Logged to the console as "[prefetch] …". */
export function startIdlePrefetch({ destinations, attractions }: PrefetchInput): () => void {
  const tier = prefetchTier();
  if (tier === "off" || destinations.length === 0) return () => {};
  let cancelled = false;

  const tasks: Array<[string, () => Promise<unknown>]> = [
    ["code:sites", () => import("@/pages/SitesPage")],
    ["code:destination", () => import("@/pages/DestinationPage")],
  ];

  if (tier === "full") {
    const pos = getSavedUserPosition();
    const nearest = pos ? findNearestDestination(destinations, pos)?.dest.slug : undefined;
    if (nearest) tasks.push([`data:${nearest}`, () => prefetchDestination(nearest)]);

    const counts = new Map<string, number>();
    for (const a of attractions) counts.set(a.destinationSlug, (counts.get(a.destinationSlug) || 0) + 1);
    Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([slug]) => slug)
      .filter(slug => slug !== nearest && destinations.some(d => d.slug === slug))
      .slice(0, 2)
      .forEach(slug => tasks.push([`site:${slug}`, () => prefetchSite(slug)]));
  }

  (async () => {
    for (const [label, run] of tasks) {
      await idle();
      if (cancelled || document.hidden) return;
      try { await run(); console.debug(`[prefetch] ${label}`); } catch { /* best effort */ }
    }
  })();

  return () => { cancelled = true; };
}
