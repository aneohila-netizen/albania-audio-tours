import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/App";
import type { TourSite } from "@shared/schema";
import { useDestinations, useAttractions } from "@/lib/useApiData";
import type { Destination, Attraction } from "@/lib/staticData";
import VisitModal from "@/components/VisitModal";
import { apiRequest } from "@/lib/queryClient";
import { getSessionId } from "@/lib/session";
import { MapPin, X, Layers, Locate, LocateFixed, Headphones, ChevronRight, ArrowRight, Search } from "lucide-react";
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
  // 10-second idle popup — shown once per session, dismissed permanently on close
  const [showExplorePopup, setShowExplorePopup] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);

  // ── Onboarding tooltip tour ─────────────────────────────────────────────────
  // Shown once per session (sessionStorage), dismissed before Explore Nearby popup
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !sessionStorage.getItem("alb_onboarded"); } catch { return true; }
  });
  const [onboardStep, setOnboardStep] = useState(0);

  function dismissOnboarding() {
    try { sessionStorage.setItem("alb_onboarded", "1"); } catch {}
    setShowOnboarding(false);
  }

  // ── Destinations list panel ───────────────────────────────────────────────
  const [showDestPanel, setShowDestPanel] = useState(false);
  const [destSearch, setDestSearch] = useState("");

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

  // ── 10-second idle prompt — show "Explore nearby" popup if user hasn't acted ─
  // Only fires after onboarding tooltip is dismissed, to avoid overlap
  useEffect(() => {
    if (popupDismissed || autoCenter || heroDismissed) return;
    const timer = setTimeout(() => {
      if (!autoCenter && !heroDismissed && !showOnboarding) {
        setShowExplorePopup(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [showOnboarding]); // re-evaluates when onboarding dismisses

  // Hide popup once GPS is activated (user acted through other means)
  useEffect(() => {
    if (autoCenter) setShowExplorePopup(false);
  }, [autoCenter]);

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

  // ── Rebuild markers when layer mode, visited status, or data finishes loading ─
  // DESTINATIONS and ATTRACTIONS start as [] while the API fetches.
  // This effect re-fires the moment they arrive, so pins appear on first load
  // without the user needing to click a tab.
  useEffect(() => {
    if (mapReadyRef.current) buildMarkers();
  }, [layerMode, visitedSiteIds, DESTINATIONS, ATTRACTIONS]);

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
                <p className="text-xs font-semibold text-primary mb-0.5">🎧 Free during launch · Subscription coming soon</p>
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
                  Free during launch · Works offline · 43 destinations · 10 walking tours
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

      {/* ── 10-second explore popup ────────────────────────────────────────────
           Shown after idle: prompts visitor to share location and discover nearby sites.
           Clean, minimal, mobile-first. X to dismiss forever in session. */}
      {showExplorePopup && !popupDismissed && !autoCenter && (
        <div
          className="absolute inset-0 z-[1050] flex items-center justify-center pointer-events-none"
          aria-live="polite"
        >
          {/* Subtle backdrop — doesn't block map, just softens it slightly */}
          <div
            className="absolute inset-0 bg-black/20 pointer-events-auto"
            onClick={() => { setShowExplorePopup(false); setPopupDismissed(true); }}
            aria-hidden="true"
          />

          {/* Popup card */}
          <div
            className="relative pointer-events-auto mx-4 w-full max-w-xs rounded-2xl bg-card shadow-2xl border border-border overflow-hidden"
            style={{ animation: "popup-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
            role="dialog"
            aria-modal="true"
            aria-label="Explore nearby places"
          >
            {/* Top accent bar */}
            <div className="h-1 w-full" style={{ background: "hsl(var(--primary))" }} />

            <div className="px-5 pt-4 pb-5">
              {/* Header row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">🗺️</span>
                  <div>
                    <p className="font-bold text-base leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                      Explore Nearby
                    </p>
                    <p className="text-xs text-muted-foreground leading-tight">Find places around you</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowExplorePopup(false); setPopupDismissed(true); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0 -mt-0.5 -mr-1"
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Body text */}
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Discover audio tours, attractions and hidden gems closest to where you are right now.
              </p>

              {/* CTA button */}
              <button
                onClick={() => {
                  setShowExplorePopup(false);
                  setPopupDismissed(true);
                  setAutoCenter(true); // triggers the existing GPS flow
                }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                <span>📍</span>
                Show Me What's Nearby
              </button>

              {/* Privacy note */}
              <p className="text-[10px] text-muted-foreground/70 text-center mt-2.5 leading-relaxed">
                Your location is used only to find nearby tours and is never stored or shared.
              </p>
            </div>
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

      {/* Scroll-down handle — mobile only, right edge of map, red-box position ──
           The map captures all touch events so users can't swipe-scroll past it.
           This pill button lets them scroll down to the footer without touching the map. */}
      <button
        className="md:hidden absolute z-[1000] flex flex-col items-center gap-0.5"
        style={{
          right: "0.5rem",
          top: "50%",
          transform: "translateY(-50%)",
          background: "hsl(var(--card)/0.92)",
          backdropFilter: "blur(4px)",
          border: "1px solid hsl(var(--border))",
          borderRadius: "999px",
          padding: "10px 6px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
          cursor: "pointer",
        }}
        aria-label="Scroll down to footer"
        title="Scroll down"
        onClick={() => {
          // Scroll past the map into the footer area
          const mapEl = document.querySelector("[data-testid='map-container']")?.parentElement?.parentElement;
          if (mapEl) {
            const rect = mapEl.getBoundingClientRect();
            window.scrollBy({ top: rect.height + 200, behavior: "smooth" });
          } else {
            window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
          }
        }}
      >
        {/* Three stacked chevron dots — universal scroll indicator */}
        <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
          <path d="M2 2L6 6L10 2" stroke="hsl(var(--muted-foreground))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 8L6 12L10 8" stroke="hsl(var(--muted-foreground))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 14L6 18L10 14" stroke="hsl(var(--muted-foreground))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: "9px", color: "hsl(var(--muted-foreground))", lineHeight: 1, writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: "0.5px" }}>scroll</span>
      </button>

      {/* Layer toggle */}
      <div className="absolute top-3 right-3 z-[1000]">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card/95 backdrop-blur p-1 shadow-md">
          <button
            onClick={() => { setLayerMode("attractions"); setShowDestPanel(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              layerMode === "attractions"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapPin size={12} /> Attractions
          </button>
          <button
            onClick={() => { setLayerMode("destinations"); setShowDestPanel(true); }}
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

      {/* ── Onboarding Tooltip Tour ─────────────────────────────────────────
           Shown once per session. 4 steps, each pointing at a key UI element.
           Appears before the Explore Nearby popup. Dismissed on Skip or step 4 Next. */}
      {showOnboarding && (() => {
        const STEPS = [
          {
            emoji: "📍",
            title: "Tap any map pin",
            body: "Each pin is a real place with an audio story. Tap it to hear the guide and see details.",
            hint: "Try tapping a red or green pin on the map",
          },
          {
            emoji: "🔍",
            title: "Search a specific place",
            body: "Looking for Berat or Skanderbeg Square? Use the search icon in the top bar to jump there directly.",
            hint: "Search icon is in the top navigation bar",
          },
          {
            emoji: "🏖️",
            title: "Browse all destinations",
            body: "Tap \u201cTour Sites\u201d in the nav to see all 43 destinations with audio tours, sorted by region.",
            hint: "\u201cTour Sites\u201d tab is in the top navigation bar",
          },
          {
            emoji: "📱",
            title: "Find your nearest tour",
            body: "Allow location access once and the map instantly shows what\u2019s closest to you \u2014 perfect for on-the-go exploration.",
            hint: "Tap \u201cShare Location\u201d at the top-left of the map",
          },
        ];
        const step = STEPS[onboardStep];
        const isLast = onboardStep === STEPS.length - 1;
        return (
          <div
            className="absolute inset-0 z-[1060] flex items-end justify-center pb-28 px-4 pointer-events-none"
            aria-live="polite"
          >
            {/* Card */}
            <div
              className="pointer-events-auto w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
              style={{ animation: "popup-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both" }}
              role="dialog"
              aria-label="Quick start guide"
            >
              {/* Progress bar */}
              <div className="flex h-1">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 transition-all duration-300"
                    style={{
                      background: i <= onboardStep ? "hsl(var(--primary))" : "hsl(var(--muted))",
                      marginRight: i < STEPS.length - 1 ? 2 : 0,
                    }}
                  />
                ))}
              </div>

              <div className="px-5 pt-4 pb-5 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl" aria-hidden="true">{step.emoji}</span>
                    <div>
                      <p className="font-bold text-sm leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                        {step.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Step {onboardStep + 1} of {STEPS.length}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={dismissOnboarding}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0 -mt-0.5 -mr-1"
                    aria-label="Skip guide"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Body */}
                <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>

                {/* Hint chip */}
                <div className="flex items-center gap-1.5 bg-primary/8 rounded-lg px-3 py-1.5">
                  <span className="text-[10px] text-primary font-medium">→ {step.hint}</span>
                </div>

                {/* Navigation — both buttons equal size so Skip is easy to find */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={dismissOnboarding}
                    className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => {
                      if (isLast) {
                        dismissOnboarding();
                      } else {
                        setOnboardStep(s => s + 1);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                    style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  >
                    {isLast ? "Got it ✓" : "Next"}
                    {!isLast && <ArrowRight size={12} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Destinations List Panel ─────────────────────────────────────────
           Slides in from the left when the Destinations layer is active.
           Lists all destinations by name; tap any to fly the map to that pin. */}
      {showDestPanel && layerMode === "destinations" && (
        <div
          className="absolute top-14 left-2 z-[1000] w-56 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl bg-card/96 backdrop-blur border border-border shadow-xl"
          style={{ animation: "slide-in-left 0.25s ease both" }}
          role="complementary"
          aria-label="Destinations list"
        >
          {/* Header */}
          <div className="sticky top-0 bg-card/96 backdrop-blur rounded-t-2xl border-b border-border">
            <div className="flex items-center justify-between px-3 py-2.5">
              <a href="/#/sites"
                className="text-sm font-semibold text-primary hover:underline underline-offset-2"
                onClick={() => { setShowDestPanel(false); setDestSearch(""); }}
              >All Destinations</a>
              <button
                onClick={() => { setShowDestPanel(false); setDestSearch(""); }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Close destinations list"
              >
                <X size={12} />
              </button>
            </div>
            {/* Search box */}
            <div className="px-2 pb-2">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={destSearch}
                  onChange={e => setDestSearch(e.target.value)}
                  placeholder="Search destinations…"
                  className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                  autoComplete="off"
                />
                {destSearch && (
                  <button
                    onClick={() => setDestSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Destination rows — sorted A–Z, filtered by search */}
          <div className="py-1">
            {[...DESTINATIONS]
              .map(dest => ({ dest, dName: destName(dest) }))
              .filter(({ dName }) =>
                !destSearch || dName.toLowerCase().includes(destSearch.toLowerCase())
              )
              .sort((a, b) => a.dName.localeCompare(b.dName))
              .map(({ dest, dName }) => (
                <button
                  key={dest.slug}
                  onClick={() => {
                    const map = mapInstanceRef.current;
                    if (map) map.flyTo([dest.lat, dest.lng], 13, { duration: 1 });
                    setShowDestPanel(false);
                    setDestSearch("");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/60 transition-colors text-left group"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#C0392B" }} />
                  <span className="text-sm text-foreground leading-tight flex-1 truncate group-hover:text-primary transition-colors">
                    {dName}
                  </span>
                  <ChevronRight size={10} className="text-muted-foreground/50 group-hover:text-primary shrink-0 transition-colors" />
                </button>
              ))
            }
            {destSearch && !DESTINATIONS.some(d => destName(d).toLowerCase().includes(destSearch.toLowerCase())) && (
              <p className="text-xs text-muted-foreground text-center py-4 px-3">No destinations match "{destSearch}"</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
