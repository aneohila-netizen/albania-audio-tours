/**
 * useApiData — fetches live data from Railway API and merges with staticData.
 * This ensures images and content updated via the admin panel show up everywhere.
 */
import { useQuery } from "@tanstack/react-query";
import type { TourSite, Attraction } from "@shared/schema";
import { DESTINATIONS, ATTRACTIONS } from "./staticData";
import type { Destination } from "./staticData";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

/** Returns destinations merged with live API imageUrls */
export function useDestinations() {
  const { data: apiSites } = useQuery<TourSite[]>({
    queryKey: [`${RAILWAY_URL}/api/sites`],
    staleTime: 60_000,
  });

  if (!apiSites || apiSites.length === 0) return DESTINATIONS;

  // Build a map of slug -> imageUrl from API
  const imageMap = new Map(apiSites.map(s => [s.slug, s.imageUrl]));

  return DESTINATIONS.map(d => ({
    ...d,
    imageUrl: imageMap.get(d.slug) || d.imageUrl,
    // Also use API description/names if they differ (admin may have updated them)
    descEn: apiSites.find(s => s.slug === d.slug)?.descEn || d.descEn,
    descAl: apiSites.find(s => s.slug === d.slug)?.descAl || d.descAl,
    descGr: apiSites.find(s => s.slug === d.slug)?.descGr || d.descGr,
  })) as Destination[];
}

/** Returns attractions merged with live API imageUrls and audio URLs */
export function useAttractions(destinationSlug?: string) {
  const { data: apiAttrs } = useQuery<Attraction[]>({
    queryKey: destinationSlug
      ? [`${RAILWAY_URL}/api/attractions/${destinationSlug}`]
      : [`${RAILWAY_URL}/api/attractions`],
    staleTime: 60_000,
    enabled: true,
  });

  const base = destinationSlug
    ? ATTRACTIONS.filter(a => a.destinationSlug === destinationSlug)
    : ATTRACTIONS;

  if (!apiAttrs || apiAttrs.length === 0) return base;

  // API is authoritative — use API data, fall back to staticData for extras
  return apiAttrs.map(a => {
    const staticMatch = ATTRACTIONS.find(s => s.slug === a.slug && s.destinationSlug === a.destinationSlug);
    return {
      ...staticMatch,
      ...a,
      imageUrl: a.imageUrl || staticMatch?.imageUrl || "",
    };
  });
}
