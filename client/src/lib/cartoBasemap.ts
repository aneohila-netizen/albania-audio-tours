const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const CARTO_ATTRIBUTION =
  OSM_ATTRIBUTION + ' © <a href="https://carto.com/attributions">CARTO</a>';

export const SATELLITE_TILES = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles © Esri — Esri, USGS, NOAA",
  maxZoom: 19,
} as const;

export function getStreetTiles(cartoKey: string) {
  return cartoKey
    ? {
        url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`,
        attribution: CARTO_ATTRIBUTION,
        maxZoom: 19,
      }
    : {
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
      };
}

export async function loadCartoBasemapKey(): Promise<string> {
  let key = import.meta.env.VITE_CARTO_BASEMAP_KEY || "";
  try {
    const response = await fetch("/map-config.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const config = await response.json();
      if (typeof config?.cartoBasemapKey === "string") {
        key = config.cartoBasemapKey;
      }
    }
  } catch {
    // A missing runtime config must never prevent a map from loading.
  }
  return key;
}
