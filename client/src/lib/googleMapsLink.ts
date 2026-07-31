/**
 * Regex extraction of coordinates from Google Maps URLs.
 *
 * Deliberately dependency-free and key-free: no Places/Geocoding API is used, so
 * this carries no quota or billing risk.
 */

export type MapsCoords = { lat: number; lng: number };

const NUM = "(-?\\d+(?:\\.\\d+)?)";

// Ordered by reliability — the first pattern that yields in-range coordinates wins.
const COORD_PATTERNS: RegExp[] = [
  new RegExp(`@${NUM},${NUM}`), //                     /maps/@40.339,20.680,15z
  new RegExp(`!3d${NUM}!4d${NUM}`), //                 /maps/place/...!3d40.339!4d20.680
  new RegExp(`[?&](?:q|query)=${NUM},\\s*${NUM}`), //  ?q=40.339,20.680
  new RegExp(`[?&]ll=${NUM},\\s*${NUM}`), //           ?ll=40.339,20.680
];

const SHORTENED_LINK = /^(?:https?:\/\/)?(?:maps\.app\.goo\.gl|goo\.gl\/maps)\//i;

function decodeSafely(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/** Short links hide the coordinates behind a redirect, so they must be resolved server-side first. */
export function isShortenedMapsLink(url: string): boolean {
  return SHORTENED_LINK.test(url.trim());
}

export function parseGoogleMapsCoords(url: string): MapsCoords | null {
  const decoded = decodeSafely(url.trim());
  for (const pattern of COORD_PATTERNS) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    return { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
  }
  return null;
}
