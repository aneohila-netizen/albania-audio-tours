/**
 * MiniMap — lightweight Leaflet map for frontend attraction/destination detail pages.
 * Shows an interactive map centred on the given lat/lng with a red marker.
 * Includes a Map / Satellite toggle button overlaid top-right.
 */
import { useEffect, useRef, useState } from "react";

const TILES = {
  street: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "© CartoDB © OpenStreetMap contributors",
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Esri, USGS, NOAA",
    maxZoom: 19,
  },
} as const;

interface MiniMapProps {
  lat: number;
  lng: number;
  label?: string;
}

export default function MiniMap({ lat, lng, label }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const tileRef      = useRef<any>(null);
  const [isSat, setIsSat] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let mounted = true;

    import("leaflet").then(L => {
      if (!mounted || !containerRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
      }).setView([lat, lng], 15);

      const tile = L.tileLayer(TILES.street.url, {
        attribution: TILES.street.attribution,
        maxZoom: TILES.street.maxZoom,
      }).addTo(map);
      tileRef.current = tile;

      // Red custom icon
      const redIcon = L.divIcon({
        html: `<div style="
          width:22px;height:34px;
          background:#C0392B;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [22, 34],
        iconAnchor: [11, 34],
        className: "",
      });

      const marker = L.marker([lat, lng], { icon: redIcon }).addTo(map);
      if (label) marker.bindPopup(label).openPopup();

      mapRef.current = map;

      const ro = new ResizeObserver(() => {
        if (containerRef.current && containerRef.current.offsetWidth > 0) {
          map.invalidateSize();
          ro.disconnect();
        }
      });
      ro.observe(containerRef.current!);
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      mounted = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; tileRef.current = null; }
    };
  }, [lat, lng]);

  // Swap tile layer when toggle changes
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L || !tileRef.current) return;
    tileRef.current.remove();
    const t = isSat ? TILES.satellite : TILES.street;
    tileRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: t.maxZoom }).addTo(map);
  }, [isSat]);

  return (
    <div style={{ position: "relative", width: "100%", height: "200px" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {/* Map / Satellite toggle */}
      <div style={{
        position: "absolute", top: 8, right: 8, zIndex: 1000,
        display: "flex", borderRadius: 8, overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.25)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }}>
        {(["Map", "Satellite"] as const).map((lbl) => {
          const active = lbl === "Map" ? !isSat : isSat;
          return (
            <button
              key={lbl}
              type="button"
              onClick={() => setIsSat(lbl === "Satellite")}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 600,
                background: active ? "#C0392B" : "rgba(255,255,255,0.92)",
                color: active ? "#fff" : "#333",
                border: "none",
                cursor: "pointer",
                lineHeight: 1.5,
              }}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}
