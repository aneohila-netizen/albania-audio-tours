/**
 * ItineraryCard — Frontend component displayed to visitors.
 * Features:
 * - Permanent label below each numbered pin on the map
 * - Click any pin → popup with "Get directions from my location" link
 * - Multiple itineraries per page (collapsible)
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

// ── Route map with permanent labels + per-pin directions popup ────────────────
function RouteMap({ waypoints, centerLat, centerLng }: {
  waypoints: Waypoint[];
  centerLat: number;
  centerLng: number;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef  = useRef<any>(null);
  const tileRef  = useRef<any>(null);
  const [isSat, setIsSat] = useState(false);

  // Swap tile layer on satellite toggle
  useEffect(() => {
    const L = (window as any).L;
    if (!mapRef.current || !L || !tileRef.current) return;
    tileRef.current.remove();
    const url = isSat
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    tileRef.current = L.tileLayer(url, {
      attribution: isSat ? "Tiles © Esri" : "© CartoDB", maxZoom: 19,
    }).addTo(mapRef.current);
  }, [isSat]);

  useEffect(() => {
    if (!divRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; tileRef.current = null; }

    const center: [number, number] = waypoints.length > 0
      ? [waypoints[0].lat, waypoints[0].lng]
      : [centerLat, centerLng];

    mapRef.current = L.map(divRef.current, {
      zoomControl: true,
      dragging: true,
      scrollWheelZoom: false,
    }).setView(center, 15);

    tileRef.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "© CartoDB",
      maxZoom: 19,
    }).addTo(mapRef.current);

    // invalidateSize handles the case where this card was collapsed (display:none) on mount
    [50, 200, 500].forEach(ms =>
      setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, ms)
    );

    waypoints.forEach((wp, idx) => {
      const total = waypoints.length;
      const isStart = idx === 0;
      const isEnd = idx === total - 1 && total > 1;
      const color = isStart ? "#22c55e" : isEnd ? "#ef4444" : "#3b82f6";
      const label = wp.title || (isStart ? "Start" : isEnd ? "End" : ("Stop " + (idx + 1)));

      // Icon = numbered circle + text label below (always visible)
      const circleHtml = [
        '<div style="display:flex;flex-direction:column;align-items:center;gap:2px">',
          '<div style="background:', color, ';color:white;border-radius:50%;',
            'width:28px;height:28px;display:flex;align-items:center;justify-content:center;',
            'font-weight:700;font-size:12px;border:2px solid white;',
            'box-shadow:0 2px 6px rgba(0,0,0,.4);flex-shrink:0">',
            String(idx + 1),
          '</div>',
          '<div style="background:rgba(255,255,255,0.95);color:#111;font-size:10px;font-weight:600;',
            'padding:1px 6px;border-radius:4px;white-space:nowrap;',
            'box-shadow:0 1px 3px rgba(0,0,0,.25);border:1px solid ', color, '55;',
            'max-width:110px;overflow:hidden;text-overflow:ellipsis">',
            label,
          '</div>',
        '</div>',
      ].join('');

      const icon = L.divIcon({
        className: "",
        html: circleHtml,
        iconSize: [28, 46],
        iconAnchor: [14, 14],
        popupAnchor: [0, -20],
      });

      // Popup with "Get directions from my location" — uses navigator.geolocation
      const destUrl = "https://www.google.com/maps/dir/?api=1&destination=" + wp.lat + "," + wp.lng + "&travelmode=walking";
      const myLocUrl = "https://www.google.com/maps/dir/My+Location/" + wp.lat + "," + wp.lng;
      const popupHtml = [
        '<div style="min-width:180px;font-family:sans-serif">',
          '<div style="font-weight:700;font-size:13px;margin-bottom:4px">',
            '<span style="display:inline-block;background:', color, ';color:white;',
              'border-radius:50%;width:20px;height:20px;text-align:center;line-height:20px;',
              'font-size:11px;margin-right:5px">', String(idx + 1), '</span>',
            label,
          '</div>',
          wp.description
            ? '<div style="font-size:11px;color:#666;margin-bottom:8px">' + wp.description + '</div>'
            : '',
          '<a href="', myLocUrl, '" target="_blank" rel="noopener noreferrer" ',
            'style="display:flex;align-items:center;gap:5px;background:#C0392B;color:white;',
            'padding:6px 10px;border-radius:6px;font-size:12px;font-weight:600;',
            'text-decoration:none;margin-bottom:4px;justify-content:center">',
            '&#x1F4CD; Get directions from my location',
          '</a>',
        '</div>',
      ].join('');

      L.marker([wp.lat, wp.lng], { icon })
        .addTo(mapRef.current)
        .bindPopup(popupHtml, { maxWidth: 240 });
    });

    // Dashed route polyline
    if (waypoints.length > 1) {
      L.polyline(
        waypoints.map(function(w) { return [w.lat, w.lng]; }),
        { color: "#6366f1", weight: 3, opacity: 0.7, dashArray: "6 4" }
      ).addTo(mapRef.current);
    }

    if (waypoints.length > 0) {
      mapRef.current.fitBounds(
        L.latLngBounds(waypoints.map(function(w) { return [w.lat, w.lng]; })),
        { padding: [40, 40], maxZoom: 16 }
      );
    }

    return function() {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; tileRef.current = null; }
    };
  }, [waypoints]);

  return (
    <div>
      <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 6 }}>
        Tap any pin to get directions from your current location.
      </p>
      <div style={{ position: "relative" }}>
        <div ref={divRef} style={{ height: 280, borderRadius: 8, border: "1px solid hsl(var(--border))", zIndex: 0 }} />
        {/* Map / Satellite toggle */}
        <div style={{
          position: "absolute", top: 8, right: 8, zIndex: 1000,
          display: "flex", borderRadius: 8, overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.25)", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}>
          {(["Map", "Satellite"] as const).map((lbl) => {
            const active = lbl === "Map" ? !isSat : isSat;
            return (
              <button key={lbl} type="button" onClick={() => setIsSat(lbl === "Satellite")}
                style={{
                  padding: "4px 10px", fontSize: 11, fontWeight: 600, lineHeight: 1.5,
                  background: active ? "#C0392B" : "rgba(255,255,255,0.92)",
                  color: active ? "#fff" : "#333", border: "none", cursor: "pointer",
                }}>{lbl}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Single itinerary card ─────────────────────────────────────────────────────
function SingleItinerary({ it, centerLat, centerLng, defaultOpen }: {
  it: Itinerary;
  centerLat: number;
  centerLng: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [showStops, setShowStops] = useState(false);
  const waypoints: Waypoint[] = (() => {
    try { return JSON.parse(it.waypoints) || []; } catch { return []; }
  })();

  const diffColor = it.difficulty === "easy"
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : it.difficulty === "moderate"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  // Full route in Google Maps (all waypoints)
  const fullRouteUrl = waypoints.length >= 2
    ? "https://www.google.com/maps/dir/" + waypoints.map(function(w) { return w.lat + "," + w.lng; }).join("/")
    : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(function(o) { return !o; })}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Route size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{it.name}</span>
            <span className={"text-[11px] font-medium px-1.5 py-0.5 rounded-full " + diffColor}>
              {it.difficulty}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1"><Clock size={11} /> {it.durationMinutes} min</span>
            {it.distanceKm ? <span className="flex items-center gap-1"><Route size={11} /> {it.distanceKm} km</span> : null}
            <span className="flex items-center gap-1"><Flag size={11} /> {waypoints.length} stops</span>
          </div>
          {it.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{it.description}</p>
          )}
        </div>
        <div className="shrink-0 mt-1">
          {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded */}
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

          {/* Route map with labeled pins + per-pin direction popups */}
          {waypoints.length > 0 && (
            <RouteMap waypoints={waypoints} centerLat={centerLat} centerLng={centerLng} />
          )}

          {/* Waypoint list — collapsed by default, toggle to expand */}
          {waypoints.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowStops(function(s) { return !s; })}
                className="w-full flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Flag size={12} className="text-primary" />
                  Route stops ({waypoints.length})
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {showStops ? "Hide" : "Show stops"}
                  {showStops ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </span>
              </button>
              {showStops && <div className="space-y-2">
                {waypoints.map(function(wp, i) {
                  const isStart = i === 0;
                  const isEnd = i === waypoints.length - 1 && waypoints.length > 1;
                  const dotColor = isStart ? "#22c55e" : isEnd ? "#ef4444" : "#3b82f6";
                  const dirUrl = "https://www.google.com/maps/dir/My+Location/" + wp.lat + "," + wp.lng;
                  return (
                    <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border/40 p-2.5 hover:bg-muted/30 transition-colors">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5"
                        style={{ background: dotColor }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="text-sm font-medium">{wp.title}</span>
                            {(isStart || isEnd) && (
                              <span
                                className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide"
                                style={{ color: dotColor }}
                              >
                                {isStart ? "Start" : "End"}
                              </span>
                            )}
                          </div>
                          {/* Per-stop directions from my location */}
                          <a
                            href={dirUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline shrink-0"
                          >
                            <Navigation size={10} />
                            Directions
                          </a>
                        </div>
                        {wp.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{wp.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}

          {/* Full route button */}
          {fullRouteUrl && (
            <a
              href={fullRouteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium text-foreground"
            >
              <Navigation size={14} />
              Open full route in Google Maps
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ItineraryCard ────────────────────────────────────────────────────────
interface Props {
  siteSlug: string;
  centerLat?: number;
  centerLng?: number;
}

export default function ItineraryCard({ siteSlug, centerLat = 41.3275, centerLng = 19.8187 }: Props) {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(function() {
    if (!siteSlug) return;
    fetch(RAILWAY_URL + "/api/itineraries/" + encodeURIComponent(siteSlug))
      .then(function(r) { return r.ok ? r.json() : []; })
      .then(function(data) { setItineraries(data || []); setLoaded(true); })
      .catch(function() { setLoaded(true); });
  }, [siteSlug]);

  if (!loaded || itineraries.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Map size={15} className="text-primary" />
        <h2 className="text-sm font-semibold">
          {itineraries.length === 1 ? "Tour Itinerary" : "Tour Itineraries (" + itineraries.length + ")"}
        </h2>
      </div>
      {itineraries.map(function(it, idx) {
        return (
          <SingleItinerary
            key={it.id}
            it={it}
            centerLat={centerLat}
            centerLng={centerLng}
            defaultOpen={idx === 0 && itineraries.length === 1}
          />
        );
      })}
    </div>
  );
}
