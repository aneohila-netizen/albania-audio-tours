/**
 * ItineraryCard — Frontend component displayed to visitors.
 * Shows one or more tour itineraries for a destination/site/attraction.
 * Each card is collapsible, shows a Leaflet route map and numbered waypoints.
 * Positioned below the Audio Guide and above the text description.
 */
import { useState, useEffect, useRef } from "react";
import { Map, ChevronDown, ChevronUp, Clock, Route, Navigation, Flag } from "lucide-react";
import { RAILWAY_URL } from "@/lib/queryClient";

interface Waypoint {
  order: number;
  lat: number;
  lng: number;
  title: string;
  description: string;
}

interface Itinerary {
  id: number;
  siteSlug: string;
  name: string;
  description: string;
  instructions: string;
  durationMinutes: number;
  distanceKm: number;
  difficulty: string;
  waypoints: string;
}

// ── Mini route map for a single itinerary ─────────────────────────────────────
function RouteMap({ waypoints, centerLat, centerLng }: { waypoints: Waypoint[]; centerLat: number; centerLng: number }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!divRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const center: [number, number] = waypoints.length > 0
      ? [waypoints[0].lat, waypoints[0].lng]
      : [centerLat, centerLng];

    mapRef.current = L.map(divRef.current, {
      zoomControl: true,
      dragging: true,
      scrollWheelZoom: false,
    }).setView(center, 15);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "© CartoDB", maxZoom: 19,
    }).addTo(mapRef.current);

    waypoints.forEach((wp, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === waypoints.length - 1 && waypoints.length > 1;
      const color = isStart ? "#22c55e" : isEnd ? "#ef4444" : "#3b82f6";
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${color};color:white;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,.3)">${idx + 1}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
      });
      L.marker([wp.lat, wp.lng], { icon })
        .addTo(mapRef.current)
        .bindTooltip(`${idx + 1}. ${wp.title}`, { permanent: false, direction: "top" });
    });

    if (waypoints.length > 1) {
      L.polyline(waypoints.map(w => [w.lat, w.lng]), {
        color: "#6366f1", weight: 3, opacity: 0.7, dashArray: "6 4",
      }).addTo(mapRef.current);
    }

    if (waypoints.length > 0) {
      mapRef.current.fitBounds(
        L.latLngBounds(waypoints.map(w => [w.lat, w.lng])),
        { padding: [30, 30], maxZoom: 16 }
      );
    }

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [waypoints]);

  return <div ref={divRef} style={{ height: 240, borderRadius: 8, zIndex: 0 }} />;
}

// ── Single itinerary card ─────────────────────────────────────────────────────
function SingleItinerary({ it, centerLat, centerLng, defaultOpen }: {
  it: Itinerary; centerLat: number; centerLng: number; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const waypoints: Waypoint[] = (() => { try { return JSON.parse(it.waypoints) || []; } catch { return []; } })();

  const diffColor = it.difficulty === "easy"
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : it.difficulty === "moderate"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  // Google Maps directions URL using all waypoints
  const mapsUrl = waypoints.length >= 2
    ? `https://www.google.com/maps/dir/${waypoints.map(w => `${w.lat},${w.lng}`).join("/")}`
    : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Route size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{it.name}</span>
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${diffColor}`}>
              {it.difficulty}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1"><Clock size={11} /> {it.durationMinutes} min</span>
            {it.distanceKm ? <span className="flex items-center gap-1"><Route size={11} /> {it.distanceKm} km</span> : null}
            <span className="flex items-center gap-1"><Flag size={11} /> {waypoints.length} stops</span>
          </div>
          {it.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{it.description}</p>}
        </div>
        <div className="shrink-0 mt-1">
          {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-border space-y-4 p-4">
          {/* Visitor instructions */}
          {it.instructions && (
            <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 space-y-1">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Navigation size={12} /> How to do this tour
              </p>
              <p className="text-xs text-foreground leading-relaxed">{it.instructions}</p>
            </div>
          )}

          {/* Route map */}
          {waypoints.length > 0 && (
            <RouteMap waypoints={waypoints} centerLat={centerLat} centerLng={centerLng} />
          )}

          {/* Waypoint list */}
          {waypoints.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Route stops</p>
              <div className="space-y-1.5">
                {waypoints.map((wp, i) => {
                  const isStart = i === 0;
                  const isEnd = i === waypoints.length - 1 && waypoints.length > 1;
                  const dotColor = isStart ? "#22c55e" : isEnd ? "#ef4444" : "#3b82f6";
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5"
                        style={{ background: dotColor }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <span className="text-sm font-medium">{wp.title}</span>
                        {(isStart || isEnd) && (
                          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{ color: dotColor }}>
                            {isStart ? "Start" : "End"}
                          </span>
                        )}
                        {wp.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{wp.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Open in Maps */}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium text-foreground"
            >
              <Navigation size={14} />
              Open route in Google Maps
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ItineraryCard — fetches all itineraries for a slug ───────────────────
interface Props {
  siteSlug: string;
  centerLat?: number;
  centerLng?: number;
}

export default function ItineraryCard({ siteSlug, centerLat = 41.3275, centerLng = 19.8187 }: Props) {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!siteSlug) return;
    fetch(`${RAILWAY_URL}/api/itineraries/${encodeURIComponent(siteSlug)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setItineraries(data || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [siteSlug]);

  // Don't render anything until loaded (avoid flicker)
  if (!loaded || itineraries.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Map size={15} className="text-primary" />
        <h2 className="text-sm font-semibold">
          {itineraries.length === 1 ? "Tour Itinerary" : `Tour Itineraries (${itineraries.length})`}
        </h2>
      </div>
      {itineraries.map((it, idx) => (
        <SingleItinerary
          key={it.id}
          it={it}
          centerLat={centerLat}
          centerLng={centerLng}
          defaultOpen={idx === 0 && itineraries.length === 1}
        />
      ))}
    </div>
  );
}
