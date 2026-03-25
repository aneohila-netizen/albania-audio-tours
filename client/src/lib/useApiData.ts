/**
 * useApiData — fetches live data from Railway API.
 * The API (Railway DB) is the single source of truth.
 * staticData is used ONLY as a loading fallback.
 *
 * Any destination or attraction created in the admin panel
 * automatically appears everywhere: map, grid, list, detail pages.
 */
import { useQuery } from "@tanstack/react-query";
import type { TourSite, Attraction as ApiAttraction } from "@shared/schema";
import { DESTINATIONS, ATTRACTIONS } from "./staticData";
import type { Destination, Attraction } from "./staticData";
import { railwayFetch } from "./queryClient";

/** Map a TourSite (DB/API shape) → Destination (frontend shape) */
function siteToDestination(s: TourSite): Destination {
  // Derive tagline from first sentence of description
  const tagline = (text: string) =>
    text ? text.split(/[.!?]/)[0].trim() : "";

  return {
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

/** Returns all destinations — API is authoritative, staticData is loading fallback */
export function useDestinations(): Destination[] {
  const { data: apiSites } = useQuery<TourSite[]>({
    queryKey: ["railway", "sites"],
    queryFn: () => railwayFetch<TourSite[]>("/api/sites"),
    staleTime: 60_000,
  });

  // API loaded → use it entirely (includes any admin-created destinations)
  if (apiSites && apiSites.length > 0) {
    return apiSites.map(siteToDestination);
  }

  // Still loading or failed → fall back to static data
  return DESTINATIONS;
}

/** Returns attractions — API is authoritative, staticData is loading fallback */
export function useAttractions(destinationSlug?: string): Attraction[] {
  const { data: apiAttrs } = useQuery<ApiAttraction[]>({
    queryKey: destinationSlug
      ? ["railway", "attractions", destinationSlug]
      : ["railway", "attractions"],
    queryFn: () =>
      destinationSlug
        ? railwayFetch<ApiAttraction[]>(`/api/attractions/${destinationSlug}`)
        : railwayFetch<ApiAttraction[]>("/api/attractions"),
    staleTime: 60_000,
    enabled: true,
  });

  const staticFallback = destinationSlug
    ? ATTRACTIONS.filter((a) => a.destinationSlug === destinationSlug)
    : ATTRACTIONS;

  // API loaded → use it entirely (includes any admin-created attractions)
  if (apiAttrs && apiAttrs.length > 0) {
    return apiAttrs.map(apiAttrToAttraction);
  }

  // Still loading or failed → fall back to static data
  return staticFallback;
}
