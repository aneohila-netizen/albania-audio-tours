/**
 * Regex extraction of coordinates from Google Maps URLs.
 *
 * Deliberately dependency-free and key-free: no Places/Geocoding API is used, so
 * this carries no quota or billing risk.
 */

export type MapsCoords = { lat: number; lng: number };

const NUM = "(-?\\d+(?:\\.\\d+)?)";

// Ordered by precision — the first pattern that yields in-range coordinates wins.
//
// `!3d/!4d` MUST stay ahead of `@`: a /maps/place/ URL carries both, but `@` is only the
// viewport centre at share time (it can sit kilometres off the place, e.g. in open water)
// while `!3d/!4d` is the anchored marker. `@` is still the right answer for a bare map view,
// which has no `!3d/!4d` to fall back from. Do not "tidy" this order.
const COORD_PATTERNS: RegExp[] = [
  new RegExp(`!3d${NUM}!4d${NUM}`), //                 /maps/place/...!3d40.339!4d20.680
  new RegExp(`@${NUM},${NUM}`), //                     /maps/@40.339,20.680,15z
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

/**
 * The repo has no test runner, so the cases the ordering above must satisfy are recorded here:
 *
 *   place URL carrying both patterns (St. Mary's Monastery, Zvërnec) —
 *     ".../place/St.+Mary's+Monastery/@40.5219496,19.3853513,15z/data=!4m6!3m5!1s0x13453715314d4353:0xae4a2ffba52f4dd3!8m2!3d40.5173874!4d19.4024067"
 *     -> { lat: 40.517387, lng: 19.402407 }   (not the 40.521950,19.385351 viewport centre)
 *   bare map view, no marker —
 *     "https://www.google.com/maps/@40.339,20.680,15z" -> { lat: 40.339, lng: 20.68 }
 *   query link —
 *     "https://www.google.com/maps?q=40.339,20.680" -> { lat: 40.339, lng: 20.68 }
 *   legacy centre link —
 *     "https://maps.google.com/?ll=40.339,20.680&z=15" -> { lat: 40.339, lng: 20.68 }
 */
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
