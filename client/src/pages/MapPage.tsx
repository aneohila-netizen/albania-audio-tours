import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/App";
import type { TourSite } from "@shared/schema";
import { useDestinations, useAttractions } from "@/lib/useApiData";
import type { Destination, Attraction } from "@/lib/staticData";
import VisitModal from "@/components/VisitModal";
import { apiRequest } from "@/lib/queryClient";
import { getSessionId } from "@/lib/session";
import { MapPin, X, Layers, Locate, LocateFixed, Headphones } from "lucide-react";
// Leaflet marker cluster — groups overlapping pins into numbered bubbles
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useAudioPlayer } from "@/components/StickyAudioPlayer";
import { getLangText } from "@/lib/i18n";

type LeafletLib = any;
type LeafletMap = any;
type LeafletMarker = any;

// All category colours — unified across the app
const CATEGORY_COLORS: Record<string, string> = {
  city:           "#C0392B",
  archaeology:    "#8B4513",
  castle:         "#4A4A6A",
  beach:          "#0A6E8C",
  nature:         "#2D7A22",
  "historic-town":"#8B6914",
  mountain:       "#5A4A78",
  lake:           "#1A6B9A",
  mosque:         "#B8860B",
  museum:         "#6B4226",
  neighbourhood:  "#7A5C2E",
  district:       "#7A5C2E",
  church:         "#4A5A6A",
  promenade:      "#1A7A6A",
  monument:       "#8B3A3A",
  market:         "#7A6A2E",
  landmark:       "#C0392B",
  "hot-springs":  "#A0522D",
  ruins:          "#7A6A5A",
};

const CATEGORY_EMOJI: Record<string, string> = {
  city: "🏙️",
  archaeology: "🏛️",
  castle: "🏰",
  beach: "🏖️",
  nature: "🏔️",
  "historic-town": "🏘️",
  mountain: "⛰️",
  lake: "🏞️",
  mosque: "🕌",
  museum: "🖼️",
  neighbourhood: "🏡",
  district: "🏡",
  church: "⛪",
  promenade: "🌊",
  monument: "🗿",
  market: "🛍️",
  landmark: "📍",
  "hot-springs": "♨️",
  ruins: "🏚️",
};

// Layer modes
type LayerMode = "destinations" | "attractions";

// Unified pin type for the popup panel
type PinItem =
  | { type: "destination"; data: Destination }
  | { type: "attraction"; data: Attraction; dest: Destination };

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap>(null);
  const LeafletRef = useRef<LeafletLib>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const mapReadyRef = useRef(false);

  const [selectedPin, setSelectedPin] = useState<PinItem | null>(null);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [layerMode, setLayerMode] = useState<LayerMode>("attractions");
  const [, navigate] = useLocation();

  const [heroDismissed, setHeroDismissed] = useState(false);

  // ── GPS blue dot state ────────────────────────────────────────────
  const [autoCenter, setAutoCenter] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // ── Nearest tour (API-driven, includes all future tours) ─────────
  // { slug: destinationSlug, name: tour name, distM: distance in metres }
  const [nearestTour, setNearestTour] = useState<{ slug: string; name: string; distM: number } | null>(null);
  // All published itineraries fetched once on mount — auto-updates when tours are added
  const [allItineraries, setAllItineraries] = useState<Array<{ siteSlug: string; name: string }>>([]);
  const blueDotRef = useRef<any>(null); // Leaflet circle marker for user location
  const watchIdRef = useRef<number | null>(null);

  // ── Geofencing state ───────────────────────────────────────
  const [geofenceToast, setGeofenceToast] = useState<{
    name: string; slug: string; destSlug: string; type: "attraction" | "destination";
  } | null>(null);
  const triggeredPoiRef = useRef<Set<string>>(new Set()); // avoid re-triggering same POI
  const { t, lang, visitedSiteIds, markVisited } = useApp();
  const { loadTrack } = useAudioPlayer();
  const DESTINATIONS = useDestinations();
  const ATTRACTIONS = useAttractions();

  // Helper: name/desc in current language (supports all 9 langs)
  const destName = (d: Destination) => getLangText(d, "name", lang);
  const attrName = (a: Attraction) => getLangText(a, "name", lang);
  const destDesc = (d: Destination) => getLangText(d, "desc", lang);
  const attrDesc = (a: Attraction) => getLangText(a, "desc", lang);

  // Holds the active cluster group so we can remove it cleanly on mode switch
  const clusterGroupRef = useRef<any>(null);

  // ── Build markers ────────────────────────────────────────────────────────────
  function buildMarkers() {
    const L = LeafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Clear old markers and old cluster group
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }

    // Create a cluster group — pins within ~60px radius cluster into a bubble
    // disableClusteringAtZoom: at zoom 13+ pins spread out individually (street level)
    const LCluster = (L as any).markerClusterGroup
      ? L
      : (window as any).L; // fallback
    let clusterGroup: any;
    try {
      // Dynamic import of the plugin to avoid SSR issues
      const MC = (L as any).markerClusterGroup;
      if (MC) {
        clusterGroup = MC({
          disableClusteringAtZoom: 13,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          maxClusterRadius: 55,
          iconCreateFunction: (cluster: any) => {
            const count = cluster.getChildCount();
            const size = count < 10 ? 36 : count < 50 ? 42 : 48;
            return (L as any).divIcon({
              html: `<div style="
                width:${size}px;height:${size}px;border-radius:50%;
                background:hsl(var(--primary));color:white;
                display:flex;align-items:center;justify-content:center;
                font-weight:700;font-size:${size < 40 ? 13 : 14}px;
                box-shadow:0 2px 8px rgba(0,0,0,0.3);
                border:2.5px solid white;
              ">${count}</div>`,
              className: "",
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            });
          },
        });
        clusterGroup.addTo(map);
        clusterGroupRef.current = clusterGroup;
      }
    } catch (_) {
      clusterGroup = null;
    }

    // Helper: add marker to cluster group if available, else directly to map
    const addTo = (marker: any) => {
      if (clusterGroup) clusterGroup.addLayer(marker);
      else marker.addTo(map);
      markersRef.current.push(marker);
    };

    if (layerMode === "destinations") {
      DESTINATIONS.forEach(dest => {
        addDestinationMarker(L, map, dest, addTo);
      });
    } else {
      // Show all attractions — plus destination markers for destinations without attractions
      const destsWithAttrs = new Set(ATTRACTIONS.map(a => a.destinationSlug));
      ATTRACTIONS.forEach(attr => {
        addAttractionMarker(L, map, attr, addTo);
      });
      // Destinations that have no attractions yet — show destination marker
      DESTINATIONS.forEach(dest => {
        if (!destsWithAttrs.has(dest.slug)) {
          addDestinationMarker(L, map, dest, addTo);
        }
      });
    }
  }

  function markerHtml(emoji: string, color: string, isVisited: boolean, size = 38) {
    return `
      <div style="
        width:${size}px; height:${size}px;
        border-radius: 50% 50% 50% 0;
        background:${isVisited ? "#2D7A22" : color};
        transform: rotate(-45deg);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 3px 12px rgba(0,0,0,0.35);
        border: 2.5px solid white;
        cursor: pointer;
      ">
        <span style="transform:rotate(45deg); font-size:${Math.round(size * 0.44)}px; line-height:1;">
          ${isVisited ? "✓" : emoji}
        </span>
      </div>`;
  }

  function addDestinationMarker(L: LeafletLib, map: LeafletMap, dest: Destination, addTo?: (m: any) => void) {
    const color = CATEGORY_COLORS[dest.category] || "#C0392B";
    const emoji = CATEGORY_EMOJI[dest.category] || "📍";
    const icon = L.divIcon({
      className: "",
      html: markerHtml(emoji, color, false, 44),
      iconSize: [44, 44],
      iconAnchor: [22, 44],
      popupAnchor: [0, -46],
    });
    const marker = L.marker([dest.lat, dest.lng], { icon }).addTo(map);
    // aria-label for screen readers and WCAG 2.1
    const destEl = marker.getElement();
    if (destEl) {
      destEl.setAttribute("role", "button");
      destEl.setAttribute("aria-label", `${destName(dest)} — ${dest.category} destination. Tap to explore.`);
      destEl.setAttribute("tabindex", "0");
      destEl.addEventListener("keydown", (e: any) => {
        if (e.key === "Enter" || e.key === " ") setSelectedPin({ type: "destination", data: dest });
      });
    }
    marker.on("click", () => setSelectedPin({ type: "destination", data: dest }));
    if (addTo) addTo(marker); else { marker.addTo(map); markersRef.current.push(marker); }
  }

  function addAttractionMarker(L: LeafletLib, map: LeafletMap, attr: Attraction, addTo?: (m: any) => void) {
    const dest = DESTINATIONS.find(d => d.slug === attr.destinationSlug)!;
    const color = CATEGORY_COLORS[attr.category] || "#C0392B";
    const emoji = CATEGORY_EMOJI[attr.category] || "📍";
    const isVisited = visitedSiteIds.has(attr.id);
    const icon = L.divIcon({
      className: "",
      html: markerHtml(emoji, color, isVisited, 36),
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -38],
    });
    const marker = L.marker([attr.lat, attr.lng], { icon }).addTo(map);
    // aria-label for screen readers and WCAG 2.1
    const attrEl = marker.getElement();
    if (attrEl) {
      attrEl.setAttribute("role", "button");
      attrEl.setAttribute("aria-label",
        `${attrName(attr)} — ${attr.category}${isVisited ? ", already visited" : ""}. Tap for details.`
      );
      attrEl.setAttribute("tabindex", "0");
      attrEl.addEventListener("keydown", (e: any) => {
        if (e.key === "Enter" || e.key === " ") setSelectedPin({ type: "attraction", data: attr, dest });
      });
    }
    marker.on("click", () => setSelectedPin({ type: "attraction", data: attr, dest }));
    if (addTo) addTo(marker); else { marker.addTo(map); markersRef.current.push(marker); }
  }

  // ── Fetch all published itineraries on mount (API-driven, future-proof) ──────
  useEffect(() => {
    fetch("/api/itineraries")
      .then(r => r.json())
      .then((data: Array<{ siteSlug: string; name: string }>) => setAllItineraries(data))
      .catch(() => {}); // silently fail — hero still shows Tirana fallback
  }, []);

  // ── Init Leaflet map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let mounted = true;

    (async () => {
      const L = (await import("leaflet")).default;
      // Load markercluster plugin after Leaflet so it can extend L
      await import("leaflet.markercluster");
      if (!mounted || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [41.0, 20.2],
        zoom: 7,
        zoomControl: false, // we add it manually at bottomright
      });
      // Industry standard: zoom controls bottom-right on mobile maps
      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }
      ).addTo(map);

      LeafletRef.current = L;
      mapInstanceRef.current = map;
      mapReadyRef.current = true;

      // Build markers immediately after map is ready
      buildMarkers();
    })();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        LeafletRef.current = null;
        mapReadyRef.current = false;
      }
    };
  }, []);

  // ── Rebuild markers when layer mode or visited status changes ─────────────
  useEffect(() => {
    if (mapReadyRef.current) buildMarkers();
  }, [layerMode, visitedSiteIds]);

  // ── GPS blue dot ────────────────────────────────────────────
  useEffect(() => {
    if (!autoCenter) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (!navigator.geolocation) {
      setGpsError("GPS not available on this device.");
      setAutoCenter(false);
      return;
    }
    setGpsError(null);

    // Haversine distance in metres between two lat/lng points
    const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371000; // Earth radius in metres
      const toRad = (x: number) => (x * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const GEOFENCE_RADIUS_M = 60; // metres — ~60m radius trigger zone

    const updateDot = (pos: GeolocationPosition) => {
      const L = LeafletRef.current;
      const map = mapInstanceRef.current;
      if (!L || !map) return;
      const { latitude: lat, longitude: lng } = pos.coords;
      if (blueDotRef.current) {
        blueDotRef.current.setLatLng([lat, lng]);
      } else {
        const blueDotIcon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:20px;height:20px;border-radius:50%;background:rgba(37,99,235,0.2);animation:gps-pulse 2s ease-out infinite;"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 0 0 2px rgba(37,99,235,0.4);"></div>
          </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        blueDotRef.current = L.marker([lat, lng], { icon: blueDotIcon, zIndexOffset: 1000 }).addTo(map);
      }
      map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });

      // ── Nearest tour (API-driven) ─────────────────
      // Find the published tour whose destination is closest to current position.
      // Uses allItineraries fetched from /api/itineraries — automatically includes
      // any new tours added in the future without code changes.
      if (allItineraries.length > 0) {
        // Build a deduplicated set of destination slugs that have a tour
        const slugsWithTours = [...new Set(allItineraries.map(it => it.siteSlug))];
        // Match each slug to a destination with known coordinates
        let bestSlug = "";
        let bestName = "";
        let bestDist = Infinity;
        for (const slug of slugsWithTours) {
          const dest = DESTINATIONS.find(d => d.slug === slug);
          if (!dest || !dest.lat || !dest.lng) continue;
          const d = haversineM(lat, lng, dest.lat, dest.lng);
          if (d < bestDist) {
            bestDist = d;
            bestSlug = slug;
            // Use the first itinerary name for this slug as the CTA label
            const firstTour = allItineraries.find(it => it.siteSlug === slug);
            bestName = firstTour?.name ?? dest.nameEn ?? slug;
          }
        }
        if (bestSlug) {
          setNearestTour({ slug: bestSlug, name: bestName, distM: bestDist });
        }
      }

      // ── Geofence check ────────────────────────────
      // Only check if GPS accuracy is good enough (<= 50m)
      if ((pos.coords.accuracy || 999) <= 80) {
        // Check attractions first (more specific)
        for (const attr of ATTRACTIONS) {
          if (attr.lat === 0 && attr.lng === 0) continue;
          const dist = haversineM(lat, lng, attr.lat, attr.lng);
          const key = `attr-${attr.id}`;
          if (dist <= GEOFENCE_RADIUS_M && !triggeredPoiRef.current.has(key)) {
            triggeredPoiRef.current.add(key);
            const dest = DESTINATIONS.find(d => d.slug === attr.destinationSlug);
            setGeofenceToast({
              name: attrName(attr),
              slug: attr.slug,
              destSlug: attr.destinationSlug,
              type: "attraction",
            });
            // Auto-dismiss after 12 seconds
            setTimeout(() => setGeofenceToast(t => t?.slug === attr.slug ? null : t), 12000);
            break; // show one toast at a time
          }
        }
      }
    };

    const onGpsError = (err: GeolocationPositionError) => {
      setGpsError(err.code === 1 ? "Location permission denied." : "Unable to get your location.");
      setAutoCenter(false);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(updateDot, onGpsError, {
      enableHighAccuracy: true, maximumAge: 5000, timeout: 10000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (blueDotRef.current) { blueDotRef.current.remove(); blueDotRef.current = null; }
    };
  }, [autoCenter]);

  const toggleAutoCenter = () => setAutoCenter(v => !v);

  // ── Handle mark visited ───────────────────────────────────────────────────
  const handleMarkVisited = async () => {
    if (!selectedPin) return;
    const id = selectedPin.type === "attraction" ? selectedPin.data.id : 0;
    const points = selectedPin.type === "attraction" ? selectedPin.data.points : 0;
    if (!id || visitedSiteIds.has(id)) return;

    markVisited(id, points);
    setShowVisitModal(true);
    try {
      await apiRequest("POST", "/api/progress", {
        sessionId: getSessionId(),
        siteId: id,
        visitedAt: new Date().toISOString(),
        pointsEarned: points,
        audioCompleted: false,
      });
    } catch (_) {}
  };

  // ── Build a compat TourSite for VisitModal ────────────────────────────────
  const visitModalSite: TourSite | null =
    selectedPin?.type === "attraction"
      ? {
          id: selectedPin.data.id,
          slug: selectedPin.data.slug,
          nameEn: selectedPin.data.nameEn,
          nameAl: selectedPin.data.nameAl,
          nameGr: selectedPin.data.nameGr,
          descEn: selectedPin.data.descEn,
          descAl: selectedPin.data.descAl,
          descGr: selectedPin.data.descGr,
          funFactEn: selectedPin.data.funFactEn,
          funFactAl: selectedPin.data.funFactAl,
          funFactGr: selectedPin.data.funFactGr,
          category: selectedPin.data.category,
          difficulty: "easy",
          region: selectedPin.dest.region,
          lat: selectedPin.data.lat,
          lng: selectedPin.data.lng,
          imageUrl: selectedPin.data.imageUrl,
          audioUrlEn: selectedPin.data.audioUrlEn || null,
          audioUrlAl: selectedPin.data.audioUrlAl || null,
          audioUrlGr: (selectedPin.data as any).audioUrlGr || null,
          // New language audio fields (passthrough from attraction)
          ...Object.fromEntries(
            ["It","Es","De","Fr","Ar","Sl"].map(s => [`audioUrl${s}`, (selectedPin.data as any)[`audioUrl${s}`] || null])
          ),
          visitDuration: selectedPin.data.visitDuration,
          points: selectedPin.data.points,
        }
      : null;

  // ── Panel helpers ─────────────────────────────────────────────────────────
  const panelTitle =
    selectedPin?.type === "destination"
      ? destName(selectedPin.data)
      : selectedPin?.type === "attraction"
      ? attrName(selectedPin.data)
      : "";

  const panelSubtitle =
    selectedPin?.type === "destination"
      ? selectedPin.data.region
      : selectedPin?.type === "attraction"
      ? `${selectedPin.dest.nameEn} · ${selectedPin.data.region || selectedPin.dest.region}`
      : "";

  const panelImage =
    selectedPin?.type === "destination"
      ? selectedPin.data.imageUrl
      : selectedPin?.type === "attraction"
      ? selectedPin.data.imageUrl
      : null;

  const panelDesc =
    selectedPin?.type === "destination"
      ? destDesc(selectedPin.data).slice(0, 200) + "…"
      : selectedPin?.type === "attraction"
      ? attrDesc(selectedPin.data).slice(0, 200) + "…"
      : "";

  const panelCategory =
    selectedPin?.type === "destination"
      ? selectedPin.data.category
      : selectedPin?.type === "attraction"
      ? selectedPin.data.category
      : "";

  const panelPoints =
    selectedPin?.type === "destination"
      ? selectedPin.data.totalPoints
      : selectedPin?.type === "attraction"
      ? selectedPin.data.points
      : 0;

  const panelDuration =
    selectedPin?.type === "destination"
      ? null
      : selectedPin?.type === "attraction"
      ? selectedPin.data.visitDuration
      : null;

  const isAttractionVisited =
    selectedPin?.type === "attraction"
      ? visitedSiteIds.has(selectedPin.data.id)
      : false;

  const handleViewDetails = () => {
    if (!selectedPin) return;
    if (selectedPin.type === "destination") {
      navigate(`/sites/${selectedPin.data.slug}`);
    } else {
      navigate(`/sites/${selectedPin.dest.slug}/${selectedPin.data.slug}`);
    }
  };

  const handlePlayFromPin = () => {
    if (!selectedPin) return;
    const data = selectedPin.data;
    const descField = `desc${lang.charAt(0).toUpperCase() + lang.slice(1)}`;
    const text = (data as any)[descField] || (data as any).descEn || "";
    const nameField = `name${lang.charAt(0).toUpperCase() + lang.slice(1)}`;
    const siteName = (data as any)[nameField] || (data as any).nameEn || "";
    const storedAudioField = `audioUrl${lang.charAt(0).toUpperCase() + lang.slice(1)}`;
    const storedUrl = (data as any)[storedAudioField] || (data as any).audioUrlEn || null;
    const detailPath = selectedPin.type === "destination"
      ? `/sites/${selectedPin.data.slug}`
      : `/sites/${(selectedPin as any).dest.slug}/${selectedPin.data.slug}`;
    loadTrack({
      siteId: data.id,
      siteSlug: data.slug,
      siteName,
      lang,
      text,
      storedUrl,
    });
    navigate(detailPath);
    setSelectedPin(null);
  };

  return (
    <div className="relative" style={{ height: "calc(100vh - 114px)" }}>
      {/* Map */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} data-testid="map-container" />

      {/* 1a: Entry hero CTA — shown on first visit, dismissed after interaction */}
      {!heroDismissed && !selectedPin && (
        <div className="absolute bottom-4 left-3 right-3 z-[999] pointer-events-none">
          <div className="bg-card/96 backdrop-blur-sm border border-primary/20 rounded-2xl shadow-2xl p-4 pointer-events-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary mb-0.5">🎧 Free Self-Guided Audio Tours</p>
                <p className="font-bold text-base leading-tight mb-1">Discover Albania — at your own pace</p>
                {/* 3-step explainer: answers "what is this?" in one glance */}
                <div className="flex items-center gap-3 my-2">
                  <div className="flex flex-col items-center gap-0.5 text-center flex-1">
                    <span className="text-base">📍</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Tap a pin</span>
                  </div>
                  <span className="text-muted-foreground/40 text-xs">→</span>
                  <div className="flex flex-col items-center gap-0.5 text-center flex-1">
                    <span className="text-base">🎧</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Hear the story</span>
                  </div>
                  <span className="text-muted-foreground/40 text-xs">→</span>
                  <div className="flex flex-col items-center gap-0.5 text-center flex-1">
                    <span className="text-base">🗺️</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Track your journey</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Free · Works offline · 43 destinations · 10 walking tours
                </p>
                <div className="flex gap-2 flex-wrap">
                  {/* Primary CTA: nearest tour when GPS is on, else Tirana fallback */}
                  <button
                    onClick={() => {
                      const dest = nearestTour?.slug ?? "tirana";
                      navigate(`/sites/${dest}`);
                      setHeroDismissed(true);
                    }}
                    className="hero-cta-pulse flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                    aria-label={nearestTour ? `Start nearest tour: ${nearestTour.name}` : "Start Tirana Tour"}
                  >
                    <Headphones size={14} />
                    {nearestTour
                      ? `Start ${DESTINATIONS.find(d => d.slug === nearestTour.slug)?.nameEn ?? nearestTour.slug} Tour`
                      : "Start Tirana Tour"}
                  </button>
                  <button
                    onClick={() => { navigate("/sites"); setHeroDismissed(true); }}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
                  >
                    Browse All
                  </button>
                </div>
                {/* Contextual hint: show distance to nearest tour when GPS is active */}
                {nearestTour && nearestTour.distM < 50000 && (
                  <p className="text-xs text-primary/70 mt-2 flex items-center gap-1">
                    <span>📍</span>
                    <span>
                      {nearestTour.distM < 1000
                        ? `${Math.round(nearestTour.distM)}m from the nearest tour`
                        : `${(nearestTour.distM / 1000).toFixed(1)}km from the nearest tour`}
                    </span>
                  </p>
                )}
              </div>
              <button
                onClick={() => setHeroDismissed(true)}
                className="p-1 rounded-lg hover:bg-muted shrink-0 -mt-1 -mr-1"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GPS error toast */}
      {gpsError && (
        <div className="absolute top-3 left-3 z-[1001] bg-destructive text-destructive-foreground text-xs rounded-lg px-3 py-2 shadow-md flex items-center gap-2">
          <span>{gpsError}</span>
          <button onClick={() => setGpsError(null)} aria-label="Dismiss" className="ml-1 font-bold">✕</button>
        </div>
      )}

      {/* Geofence arrival toast */}
      {geofenceToast && (
        <div className="absolute bottom-6 left-3 right-3 z-[1002] animate-in slide-in-from-bottom-4">
          <div className="bg-card border border-primary/30 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary mb-0.5">📍 You’ve arrived!</p>
              <p className="text-sm font-semibold truncate">{geofenceToast.name}</p>
              <p className="text-xs text-muted-foreground mb-2">Start your audio guide?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigate(`/sites/${geofenceToast.destSlug}/${geofenceToast.slug}`);
                    setGeofenceToast(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  aria-label={`Start audio guide for ${geofenceToast.name}`}
                >
                  <Headphones size={13} /> Start Listening
                </button>
                <button
                  onClick={() => setGeofenceToast(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
                  aria-label="Dismiss arrival notification"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              onClick={() => setGeofenceToast(null)}
              className="p-1 rounded hover:bg-muted shrink-0 -mt-1 -mr-1"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* GPS locate button — pulses until activated to guide the user */}
      <div className="absolute top-3 left-3 z-[1000]">
        {/* Inner wrapper is relative so locate-ring span positions against the button */}
        <div className="relative inline-flex">
        {/* Outer glow ring — only when GPS is off, draws attention without being intrusive */}
        {!autoCenter && (
          <span
            className="locate-ring pointer-events-none"
            aria-hidden="true"
          />
        )}
        <button
          onClick={toggleAutoCenter}
          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl border shadow-md text-xs font-semibold transition-all duration-300 ${
            autoCenter
              ? "bg-blue-600 text-white border-blue-700 scale-100"
              : "bg-card/95 backdrop-blur border-blue-300 text-blue-600 hover:text-blue-700 hover:border-blue-400 locate-btn-pulse"
          }`}
          aria-label={autoCenter ? "Stop following my location" : "Share your location to find tours near you"}
          title={autoCenter ? "Auto-center ON — tap to stop" : "Share your location to discover nearby tours"}
        >
          {autoCenter ? <LocateFixed size={14} /> : <Locate size={14} />}
          {autoCenter ? "Following" : "Share Location"}
        </button>
        </div>
      </div>

      {/* Layer toggle */}
      <div className="absolute top-3 right-3 z-[1000]">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card/95 backdrop-blur p-1 shadow-md">
          <button
            onClick={() => setLayerMode("attractions")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              layerMode === "attractions"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapPin size={12} /> Attractions
          </button>
          <button
            onClick={() => setLayerMode("destinations")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              layerMode === "destinations"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers size={12} /> Destinations
          </button>
        </div>
      </div>

      {/* Selected pin panel */}
      {selectedPin && (
        <div
          className="absolute bottom-0 left-0 right-0 z-[1000] side-panel"
          style={{ maxHeight: "60vh" }}
          data-testid="site-panel"
        >
          <div className="bg-card border-t border-border rounded-t-2xl shadow-xl overflow-y-auto max-h-full">
            <div className="flex items-start justify-between p-4 pb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ background: CATEGORY_COLORS[panelCategory] || "#C0392B" }}
                  >
                    {CATEGORY_EMOJI[panelCategory] || "📍"}{" "}
                    {panelCategory.charAt(0).toUpperCase() + panelCategory.slice(1).replace("-", " ")}
                  </span>
                  {selectedPin.type === "attraction" && isAttractionVisited && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#2D7A22" }}>
                      ✓ Visited
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {panelTitle}
                </h2>
                <p className="text-xs text-muted-foreground">
                  <MapPin size={10} className="inline mr-0.5" />{panelSubtitle}
                </p>
              </div>
              <button
                data-testid="close-panel"
                onClick={() => setSelectedPin(null)}
                className="ml-2 p-1.5 rounded-full hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Image */}
            {panelImage && (
              <div className="px-4 pb-3">
                <img
                  src={panelImage}
                  alt={panelTitle}
                  className="w-full h-36 object-cover rounded-xl"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}

            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-3">{panelDesc}</p>

              {/* Stats */}
              <div className="flex gap-3">
                <div className="flex-1 rounded-lg bg-muted p-2 text-center">
                  <div className="points-badge justify-center">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M6 1L7.5 4.5H11L8 6.5L9.5 10L6 8L2.5 10L4 6.5L1 4.5H4.5L6 1Z" />
                    </svg>
                    {panelPoints}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.points}</div>
                </div>
                {panelDuration && (
                  <div className="flex-1 rounded-lg bg-muted p-2 text-center">
                    <div className="text-sm font-semibold">{panelDuration}m</div>
                    <div className="text-xs text-muted-foreground">{t.minuteRead}</div>
                  </div>
                )}
              </div>

              {/* Tour metadata — duration, stops */}
              {selectedPin?.type === "attraction" && selectedPin.data.visitDuration && (
                <p className="text-xs text-muted-foreground flex items-center gap-3">
                  <span>⏱ {selectedPin.data.visitDuration} min visit</span>
                  <span>★ {selectedPin.data.points} pts</span>
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handlePlayFromPin}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  aria-label="Play audio guide"
                >
                  <Headphones size={14} /> Play Audio
                </button>
                <button
                  data-testid="view-details-btn"
                  onClick={handleViewDetails}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
                >
                  Details
                </button>
                {selectedPin.type === "attraction" && (
                  <button
                    data-testid="mark-visited-btn"
                    onClick={handleMarkVisited}
                    disabled={isAttractionVisited}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                    style={{
                      background: isAttractionVisited ? "hsl(var(--muted))" : "hsl(var(--primary))",
                      color: isAttractionVisited ? "hsl(var(--muted-foreground))" : "hsl(var(--primary-foreground))",
                    }}
                  >
                    {isAttractionVisited ? t.alreadyVisited : t.markVisited}
                  </button>
                )}
                {selectedPin.type === "destination" && (
                  <button
                    data-testid="explore-dest-btn"
                    onClick={handleViewDetails}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  >
                    Explore
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visit modal */}
      {showVisitModal && visitModalSite && (
        <VisitModal
          site={visitModalSite}
          onClose={() => setShowVisitModal(false)}
        />
      )}
    </div>
  );
}
