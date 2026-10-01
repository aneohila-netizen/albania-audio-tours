/**
 * NearbyExplorer — subscriber-only "Explore Nearby" feature on destination pages.
 *
 * Uses the destination's known lat/lng as the search centre — no extra location
 * permission needed. Results come from the server-side /api/nearby proxy that
 * keeps the Google Places API key off the client entirely.
 *
 * Categories:
 *   Hotels · Restaurants · Things to Do · Emergency · Police
 *
 * Sort:  Nearest · Top Rated · Price ↑ · Price ↓
 * Filter: distance haversine-calculated client-side from destination coords.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BedDouble, Utensils, Sparkles, ShieldAlert, Phone,
  Star, MapPin, ArrowUpDown, ChevronDown, ChevronUp,
  Loader2, AlertCircle, ExternalLink, Navigation2,
  RefreshCw, ArrowLeft, Headphones,
} from "lucide-react";
import { Link } from "wouter";
import { RAILWAY_URL } from "@/lib/queryClient";

// ── Types ────────────────────────────────────────────────────────────────────

interface PlaceResult {
  placeId: string;
  name: string;
  vicinity: string;
  rating: number | null;
  userRatingsTotal: number;
  priceLevel: number | null;
  lat: number | null;
  lng: number | null;
  photoRef: string | null;
  types: string[];
  openNow: boolean | null;
  distanceM?: number; // computed client-side
}

interface NearbyResponse {
  results: PlaceResult[];
  configured: boolean;
  error?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALBANIA_EMERGENCY = {
  general:   { label: "Emergency",  number: "112",  color: "#C0392B" },
  police:    { label: "Police",     number: "129",  color: "#1A4A8A" },
  ambulance: { label: "Ambulance",  number: "127",  color: "#1A7A4A" },
  fire:      { label: "Fire",       number: "128",  color: "#E67E22" },
};

type CategoryKey = "hotels" | "restaurants" | "todo" | "emergency" | "police";

const CATEGORIES: { key: CategoryKey; label: string; icon: React.ReactNode; type: string; color: string }[] = [
  { key: "hotels",      label: "Hotels",        icon: <BedDouble size={15} />,    type: "lodging",             color: "#8B3A3A" },
  { key: "restaurants", label: "Restaurants",   icon: <Utensils size={15} />,     type: "restaurant",          color: "#E67E22" },
  { key: "todo",        label: "Things to Do",  icon: <Sparkles size={15} />,     type: "tourist_attraction",  color: "#1A6B9A" },
  { key: "emergency",   label: "Emergency",     icon: <ShieldAlert size={15} />,  type: "hospital",            color: "#C0392B" },
  { key: "police",      label: "Police",        icon: <Phone size={15} />,        type: "police",              color: "#1A4A8A" },
];

type SortKey = "nearest" | "rating" | "price_asc" | "price_desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "nearest",    label: "Nearest" },
  { key: "rating",     label: "Top Rated" },
  { key: "price_asc",  label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function priceLabel(level: number | null): string {
  if (level === null) return "";
  return "€".repeat(Math.min(level + 1, 4));
}

function sortResults(results: PlaceResult[], sort: SortKey): PlaceResult[] {
  const arr = [...results];
  switch (sort) {
    case "nearest":    return arr.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
    case "rating":     return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "price_asc":  return arr.sort((a, b) => (a.priceLevel ?? 99) - (b.priceLevel ?? 99));
    case "price_desc": return arr.sort((a, b) => (b.priceLevel ?? -1) - (a.priceLevel ?? -1));
    default:           return arr;
  }
}

// ── Place photo URL ──────────────────────────────────────────────────────────

function photoUrl(ref: string): string {
  return `${RAILWAY_URL}/api/nearby/photo/${encodeURIComponent(ref)}?maxwidth=400`;
}

// ── PlaceCard ────────────────────────────────────────────────────────────────

function PlaceCard({ place, destLat, destLng }: { place: PlaceResult; destLat: number; destLng: number }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.placeId}`;
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
        {place.photoRef && !imgErr ? (
          <img
            src={photoUrl(place.photoRef)}
            alt={place.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-muted-foreground/40">
            <MapPin size={20} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight truncate">{place.name}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{place.vicinity}</p>

        {/* Rating + price + distance */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {place.rating !== null && (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600">
              <Star size={10} fill="currentColor" /> {place.rating.toFixed(1)}
              <span className="text-muted-foreground font-normal ml-0.5">({place.userRatingsTotal})</span>
            </span>
          )}
          {place.priceLevel !== null && (
            <span className="text-xs text-muted-foreground font-medium">{priceLabel(place.priceLevel)}</span>
          )}
          {place.distanceM !== undefined && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Navigation2 size={9} /> {formatDist(place.distanceM)}
            </span>
          )}
          {place.openNow === true && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Open</span>
          )}
          {place.openNow === false && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Closed</span>
          )}
        </div>
      </div>

      {/* Directions link */}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
        aria-label={`Open ${place.name} in Google Maps`}
      >
        <ExternalLink size={14} />
      </a>
    </div>
  );
}

// ── NearbyExplorer ───────────────────────────────────────────────────────────

interface Props {
  destLat: number;
  destLng: number;
  destName: string;
  destSlug?: string;      // for back-to-destination link
  initialOpen?: boolean;  // auto-expand when ?nearby=1 is in the URL
}

export default function NearbyExplorer({ destLat, destLng, destName, destSlug, initialOpen = false }: Props) {
  const [open, setOpen] = useState(initialOpen);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("hotels");
  const [sort, setSort] = useState<SortKey>("nearest");
  const [showSort, setShowSort] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!showSort) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSort]);

  const fetchCategory = useCallback(async (cat: CategoryKey) => {
    if (cat === "emergency") return; // static data, no fetch
    const catConfig = CATEGORIES.find(c => c.key === cat);
    if (!catConfig) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${RAILWAY_URL}/api/nearby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: destLat, lng: destLng, type: catConfig.type }),
      });
      const data: NearbyResponse = await r.json();
      setConfigured(data.configured ?? true);
      if (data.error && data.configured) {
        setError(data.error);
        setResults([]);
        return;
      }
      // Compute distance from destination for each result
      const withDist = (data.results || []).map(p => ({
        ...p,
        distanceM: (p.lat !== null && p.lng !== null)
          ? haversineM(destLat, destLng, p.lat, p.lng)
          : undefined,
      }));
      setResults(withDist);
    } catch {
      setError("Connection error. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [destLat, destLng]);

  // Fetch when panel opens or category changes
  useEffect(() => {
    if (!open) return;
    fetchCategory(activeCategory);
  }, [open, activeCategory, fetchCategory]);

  const catConfig = CATEGORIES.find(c => c.key === activeCategory)!;
  const sorted = sortResults(results, sort);
  const activeSortLabel = SORT_OPTIONS.find(s => s.key === sort)?.label ?? "Sort";

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-4 bg-card hover:bg-muted/40 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "hsl(var(--primary)/0.1)" }}>
          <Navigation2 size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>
            Explore Nearby
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hotels · Restaurants · Things to do · Emergency
          </p>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* ── Expanded panel ── */}
      {open && (
        <div className="border-t border-border">

          {/* ── Back-to-destination banner — only shown when arrived via ?nearby=1 ── */}
          {initialOpen && destSlug && (
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-primary/5 border-b border-primary/20">
              <Link href={`/sites/${destSlug}`}>
                <a className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline">
                  <ArrowLeft size={13} /> Back to {destName}
                </a>
              </Link>
              <Link href={`/sites/${destSlug}`}>
                <a className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                  <Headphones size={12} /> View Audio Tours
                </a>
              </Link>
            </div>
          )}

          {/* Google API not configured — admin notice */}
          {!configured && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200/60">
              <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold">Google Places API not configured</p>
                  <p className="text-xs mt-0.5">
                    Add <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">GOOGLE_PLACES_API_KEY</code> in Railway → Variables to enable live nearby results.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Category pills */}
          <div
            className="flex gap-1.5 px-3 pt-3 pb-2 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => { setActiveCategory(cat.key); setSort("nearest"); }}
                  className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: active ? cat.color : "hsl(var(--muted))",
                    color: active ? "#fff" : "hsl(var(--foreground))",
                    border: active ? `1.5px solid ${cat.color}` : "1.5px solid hsl(var(--border))",
                  }}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── Emergency: static content ── */}
          {activeCategory === "emergency" && (
            <div className="px-3 pb-4 space-y-3">
              {/* Emergency numbers card */}
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30 p-3">
                <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 uppercase tracking-wide">
                  🇦🇱 Albania Emergency Numbers
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(ALBANIA_EMERGENCY).map(em => (
                    <a
                      key={em.number}
                      href={`tel:${em.number}`}
                      className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: em.color }}>
                        <Phone size={13} />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">{em.label}</p>
                        <p className="text-sm font-bold" style={{ color: em.color }}>{em.number}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Nearby hospitals from Places API */}
              {configured && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 px-0.5">Nearby Hospitals & Clinics</p>
                  {loading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 size={18} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : error ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
                      <AlertCircle size={14} /> {error}
                    </div>
                  ) : sorted.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No results found nearby.</p>
                  ) : (
                    <div className="space-y-2">
                      {sorted.map(p => <PlaceCard key={p.placeId} place={p} destLat={destLat} destLng={destLng} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Regular categories: Hotels / Restaurants / Things to Do / Police ── */}
          {activeCategory !== "emergency" && (
            <div className="px-3 pb-4">
              {/* Sort control */}
              {results.length > 0 && !loading && (
                <div className="flex items-center justify-between mb-2" ref={sortRef}>
                  <p className="text-xs text-muted-foreground">
                    {results.length} place{results.length !== 1 ? "s" : ""} near {destName}
                  </p>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSort(v => !v)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <ArrowUpDown size={11} /> {activeSortLabel}
                    </button>
                    {showSort && (
                      <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[130px]">
                        {SORT_OPTIONS.map(s => (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => { setSort(s.key); setShowSort(false); }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                              sort === s.key
                                ? "bg-primary text-primary-foreground font-semibold"
                                : "hover:bg-muted"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Loader2 size={22} className="animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Finding nearby {catConfig.label.toLowerCase()}…</p>
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
                    <AlertCircle size={14} /> {error}
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchCategory(activeCategory)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <RefreshCw size={11} /> Try again
                  </button>
                </div>
              )}

              {/* No results */}
              {!loading && !error && results.length === 0 && configured && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No {catConfig.label.toLowerCase()} found within 3 km.
                </p>
              )}

              {/* Results */}
              {!loading && !error && sorted.length > 0 && (
                <div className="space-y-2">
                  {sorted.map(p => <PlaceCard key={p.placeId} place={p} destLat={destLat} destLng={destLng} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
