/**
 * useApiData — fetches live data from Railway API.
 * The API (Railway DB) is the single source of truth.
 * staticData is used ONLY as a loading fallback.
 *
 * Any destination or attraction created in the admin panel
 * automatically appears everywhere: map, grid, list, detail pages.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TourSite, Attraction as ApiAttraction } from "@shared/schema";
import type { Destination, Attraction } from "./staticData";
import { railwayFetch } from "./queryClient";

/** Map a TourSite (DB/API shape) → Destination (frontend shape) */
function siteToDestination(s: TourSite): Destination {
  // Derive tagline from first sentence of description
  const tagline = (text: string) =>
    text ? text.split(/[.!?]/)[0].trim() : "";

  return {
    id: s.id,
    slug: s.slug,
    nameEn: s.nameEn || "",
    nameAl: s.nameAl || s.nameEn || "",
    nameGr: s.nameGr || s.nameEn || "",
    taglineEn: tagline(s.descEn || ""),
    taglineAl: tagline(s.descAl || s.descEn || ""),
    taglineGr: tagline(s.descGr || s.descEn || ""),
    descEn: s.descEn || "",
    descAl: s.descAl || s.descEn || "",
    descGr: s.descGr || s.descEn || "",
    imageUrl: s.imageUrl || "",
    lat: s.lat,
    lng: s.lng,
    region: s.region || "",
    category: s.category || "historic-town",
    totalPoints: s.points || 100,
  };
}

/** Map an ApiAttraction (DB shape) → Attraction (frontend shape) */
function apiAttrToAttraction(a: ApiAttraction): Attraction {
  return {
    id: a.id,
    slug: a.slug,
    destinationSlug: a.destinationSlug,
    nameEn: a.nameEn || "",
    nameAl: a.nameAl || a.nameEn || "",
    nameGr: a.nameGr || a.nameEn || "",
    descEn: a.descEn || "",
    descAl: a.descAl || a.descEn || "",
    descGr: a.descGr || a.descEn || "",
    funFactEn: a.funFactEn || "",
    funFactAl: a.funFactAl || a.funFactEn || "",
    funFactGr: a.funFactGr || a.funFactEn || "",
    category: a.category || "landmark",
    points: a.points || 100,
    lat: a.lat,
    lng: a.lng,
    imageUrl: a.imageUrl || "",
    visitDuration: a.visitDuration || 60,
  };
}

/**
 * Lite list endpoints (?view=lite&lang=xx): names, coordinates, categories, images and a
 * short description snippet for English + the current language — ~150 KB instead of ~3 MB.
 * Full descriptions come from the per-destination / per-attraction detail endpoints.
 */
export const sitesLiteKey = (lang: string) => ["railway", "sites", "lite", lang] as const;
export const attractionsLiteKey = (lang: string) => ["railway", "attractions", "lite", lang] as const;
export const fetchSitesLite = (lang: string) => railwayFetch<TourSite[]>(`/api/sites?view=lite&lang=${lang}`);
export const fetchAttractionsLite = (lang: string) => railwayFetch<ApiAttraction[]>(`/api/attractions?view=lite&lang=${lang}`);

const EMPTY_DESTINATIONS: Destination[] = [];
const EMPTY_ATTRACTIONS: Attraction[] = [];

/** Returns all destinations — API is authoritative, staticData is loading fallback */
export function useDestinations(lang: string = "en"): Destination[] {
  const { data: apiSites } = useQuery<TourSite[]>({
    queryKey: sitesLiteKey(lang),
    queryFn: () => fetchSitesLite(lang),
    staleTime: 5 * 60_000,  // 5 min — aligned with QueryClient default
    gcTime:   30 * 60_000,  // keep in cache 30 min after last use
    placeholderData: (prev) => prev, // language switch: keep showing the previous list while the new one loads
  });

  // Memoised on the query data: a fresh array every render made every effect that depends on the
  // list (map markers, audio preload, ...) re-run on every unrelated state change.
  return useMemo(
    () => (apiSites && apiSites.length > 0 ? apiSites.map(siteToDestination) : EMPTY_DESTINATIONS),
    [apiSites],
  );
}

/** Returns true while the sites query is in-flight (no cached data yet) */
export function useDestinationsLoading(): boolean {
  // The app always starts in English, so the English lite list is the one that gates first paint.
  const { isFetching, data } = useQuery<TourSite[]>({
    queryKey: sitesLiteKey("en"),
    queryFn: () => fetchSitesLite("en"),
    staleTime: 5 * 60_000,
    gcTime:   30 * 60_000,
  });
  return isFetching && (!data || data.length === 0);
}

/**
 * Returns attractions — API is authoritative, staticData is loading fallback.
 * With a destinationSlug: that destination's attractions (full rows, used by detail screens).
 * Without: the lite list of every attraction (map markers, search, counts).
 */
export function useAttractions(destinationSlug?: string, lang: string = "en"): Attraction[] {
  const { data: apiAttrs } = useQuery<ApiAttraction[]>({
    queryKey: destinationSlug
      ? ["railway", "attractions", destinationSlug]
      : attractionsLiteKey(lang),
    queryFn: () =>
      destinationSlug
        ? railwayFetch<ApiAttraction[]>(`/api/attractions/${destinationSlug}`)
        : fetchAttractionsLite(lang),
    staleTime: destinationSlug ? 60_000 : 5 * 60_000,
    enabled: true,
    placeholderData: (prev) => prev,
  });

  // API loaded → use it entirely (includes any admin-created attractions); still loading or
  // failed → empty (no Unsplash placeholders). Memoised for stable identity (see useDestinations).
  return useMemo(
    () => (apiAttrs && apiAttrs.length > 0 ? apiAttrs.map(apiAttrToAttraction) : EMPTY_ATTRACTIONS),
    [apiAttrs],
  );
}

// ─── Prefetch helpers ─────────────────────────────────────────────────────────
// Call these when the user shows intent to visit a destination (hover, tap)
// so the data is in TanStack cache by the time the page renders.
import { queryClient } from "./queryClient";
import type { TourSite as TourSiteType } from "@shared/schema";

/**
 * prefetchDestination — warms the TanStack cache for a destination page.
 * Fires /api/sites/:slug and /api/attractions/:slug in parallel.
 * Silent: never throws, never blocks the UI thread.
 * Safe to call repeatedly — TanStack deduplicates in-flight requests.
 */
export function prefetchDestination(slug: string): Promise<void> {
  if (!slug) return Promise.resolve();
  // Destination detail (full row with all language fields) + attractions, in parallel.
  return Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ["railway", "sites", slug],
      queryFn: () => railwayFetch<TourSiteType>(`/api/sites/${slug}`),
      staleTime: 5 * 60_000,
    }),
    queryClient.prefetchQuery({
      queryKey: ["railway", "attractions", slug],
      queryFn: () => railwayFetch<ApiAttraction[]>(`/api/attractions/${slug}`),
      staleTime: 60_000,
    }),
  ]).then(() => undefined);
}

/** Warms only the destination detail (small) — used for "likely next" idle prefetching. */
export function prefetchSite(slug: string): Promise<void> {
  if (!slug) return Promise.resolve();
  return queryClient
    .prefetchQuery({
      queryKey: ["railway", "sites", slug],
      queryFn: () => railwayFetch<TourSiteType>(`/api/sites/${slug}`),
      staleTime: 5 * 60_000,
    })
    .then(() => undefined, () => undefined);
}
