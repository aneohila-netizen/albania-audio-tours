import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/App";
import type { TourSite } from "@shared/schema";
import { useDestinations, useAttractions } from "@/lib/useApiData";
import type { Destination, Attraction } from "@/lib/staticData";
import VisitModal from "@/components/VisitModal";
import { apiRequest } from "@/lib/queryClient";
import { getSessionId } from "@/lib/session";
import { MapPin, X, Layers } from "lucide-react";
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
  const { t, lang, visitedSiteIds, markVisited } = useApp();
  const DESTINATIONS = useDestinations();
  const ATTRACTIONS = useAttractions();

  // Helper: name/desc in current language (supports all 9 langs)
  const destName = (d: Destination) => getLangText(d, "name", lang);
  const attrName = (a: Attraction) => getLangText(a, "name", lang);
  const destDesc = (d: Destination) => getLangText(d, "desc", lang);
  const attrDesc = (a: Attraction) => getLangText(a, "desc", lang);

  // ── Build markers ────────────────────────────────────────────────────────────
  function buildMarkers() {
    const L = LeafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (layerMode === "destinations") {
      DESTINATIONS.forEach(dest => {
        addDestinationMarker(L, map, dest);
      });
    } else {
      // Show all attractions — plus destination markers for destinations without attractions
      const destsWithAttrs = new Set(ATTRACTIONS.map(a => a.destinationSlug));
      ATTRACTIONS.forEach(attr => {
        addAttractionMarker(L, map, attr);
      });
      // Destinations that have no attractions yet — show destination marker
      DESTINATIONS.forEach(dest => {
        if (!destsWithAttrs.has(dest.slug)) {
          addDestinationMarker(L, map, dest);
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

  function addDestinationMarker(L: LeafletLib, map: LeafletMap, dest: Destination) {
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
    marker.on("click", () => setSelectedPin({ type: "destination", data: dest }));
    markersRef.current.push(marker);
  }

  function addAttractionMarker(L: LeafletLib, map: LeafletMap, attr: Attraction) {
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
    marker.on("click", () => setSelectedPin({ type: "attraction", data: attr, dest }));
    markersRef.current.push(marker);
  }

  // ── Init Leaflet map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let mounted = true;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!mounted || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [41.0, 20.2],
        zoom: 7,
        zoomControl: true,
      });

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

  return (
    <div className="relative" style={{ height: "calc(100vh - 114px)" }}>
      {/* Map */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} data-testid="map-container" />

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

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  data-testid="view-details-btn"
                  onClick={handleViewDetails}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
                >
                  View Details
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
