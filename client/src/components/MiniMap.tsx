/**
 * MiniMap — lightweight Leaflet map for frontend attraction/destination detail pages.
 * Shows an interactive map centred on the given lat/lng with a red marker.
 * The "Get Directions" link (passed as children or rendered automatically) opens Google Maps.
 */
import { useEffect, useRef } from "react";

interface MiniMapProps {
  lat: number;
  lng: number;
  label?: string;
}

export default function MiniMap({ lat, lng, label }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let mounted = true;

    import("leaflet").then(L => {
      if (!mounted || !containerRef.current) return;

      // Fix default marker icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        zoomControl: true,
        scrollWheelZoom: false, // prevent accidental zoom when scrolling the page
        dragging: true,
      }).setView([lat, lng], 15);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "© CartoDB",
        maxZoom: 19,
      }).addTo(map);

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

      // Ensure tiles render correctly (ResizeObserver handles hidden-tab case)
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "200px" }}
    />
  );
}
