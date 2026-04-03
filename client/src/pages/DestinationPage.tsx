import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useApp } from "@/App";
import { useQuery } from "@tanstack/react-query";
import type { TourSite, Attraction } from "@shared/schema";
import { railwayFetch } from "@/lib/queryClient";
import MiniMap from "@/components/MiniMap";
import AudioPlayer from "@/components/AudioPlayer";
import PaywallGate from "@/components/PaywallGate";
import BookWithGuide from "@/components/BookWithGuide";
import StarRatingDisplay from "@/components/StarRatingDisplay";
import ItineraryCard from "@/components/ItineraryCard";
import { ArrowLeft, MapPin, Star, Clock, ChevronRight, Lightbulb, Navigation, LayoutGrid, List } from "lucide-react";
import GallerySlideshow from "@/components/GallerySlideshow";
import { Skeleton } from "@/components/ui/skeleton";
import { getLangText } from "@/lib/i18n";
import BackToTop from "@/components/BackToTop";

const CATEGORY_COLORS: Record<string, string> = {
  city: "#C0392B", archaeology: "#8B4513", castle: "#4A4A6A",
  beach: "#0A6E8C", nature: "#2D7A22", "historic-town": "#8B6914",
  mountain: "#5A4A78", lake: "#1A6B9A", mosque: "#B8860B",
  museum: "#6B4226", district: "#7A5C2E", church: "#4A5A6A",
  promenade: "#1A7A6A", monument: "#8B3A3A", market: "#7A6A2E",
  "hot-springs": "#A0522D", ruins: "#7A6A5A", landmark: "#C0392B",
};

const CATEGORY_EMOJI: Record<string, string> = {
  city: "🏙️", archaeology: "🏛️", castle: "🏰", beach: "🏖️",
  nature: "🏔️", "historic-town": "🏘️", mountain: "⛰️", lake: "🏞️",
  mosque: "🕌", museum: "🖼️", district: "🏡", church: "⛪",
  promenade: "🌊", monument: "🗿", market: "🛍️", "hot-springs": "♨️",
  ruins: "🏚️", landmark: "📍",
};

export default function DestinationPage() {
  const [, params] = useRoute("/sites/:dest");
  const [, navigate] = useLocation();
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [attrFilter, setAttrFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const { lang, visitedSiteIds } = useApp();

  // Fetch destination directly from Railway (bypasses Perplexity proxy)
  const { data: dest, isLoading: destLoading } = useQuery<TourSite>({
    queryKey: ["railway", "sites", params?.dest],
    queryFn: () => railwayFetch<TourSite>(`/api/sites/${params?.dest}`),
    enabled: !!params?.dest,
  });

  // Fetch attractions directly from Railway (bypasses Perplexity proxy)
  const { data: attractions = [], isLoading: attrsLoading } = useQuery<Attraction[]>({
    queryKey: ["railway", "attractions", params?.dest],
    queryFn: () => railwayFetch<Attraction[]>(`/api/attractions/${params?.dest}`),
    enabled: !!params?.dest,
  });

  if (destLoading || attrsLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!dest) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
        <p className="font-semibold">Destination not found</p>
        <button onClick={() => navigate("/sites")} className="mt-4 text-primary underline text-sm">
          Back to Destinations
        </button>
      </div>
    );
  }

  const name = getLangText(dest, "name", lang);
  const desc = getLangText(dest, "desc", lang);
  // Derive tagline: first sentence of description
  const tagline = desc.split(".")[0];

  const attrName = (a: Attraction) => getLangText(a, "name", lang);
  const attrDesc = (a: Attraction) => getLangText(a, "desc", lang);
  const totalVisited = attractions.filter(a => visitedSiteIds.has(a.id)).length;
  const totalAttrPoints = attractions.reduce((s, a) => s + a.points, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <button data-testid="back-btn" onClick={() => navigate("/sites")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} />
          All Destinations
        </button>

      {/* Hero — 16:9, matches content width */}
      <GallerySlideshow
        imageUrl={dest.imageUrl}
        images={(dest as any).images || []}
        alt={name}
        interval={5000}
        
      >
        {/* Overlay: title only — tagline removed to keep hero image clean */}
        <div className="absolute bottom-0 left-0 right-0 p-5 pointer-events-none">
          <h1 className="text-3xl font-bold text-white leading-tight drop-shadow-lg" style={{ fontFamily: "var(--font-display)" }}>
            {name}
          </h1>
        </div>
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end pointer-events-none">
          {totalAttrPoints > 0 && (
            <span className="points-badge">
              <Star size={9} fill="currentColor" />
              {totalAttrPoints} pts total
            </span>
          )}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "rgba(0,0,0,0.45)" }}>
            <MapPin size={10} className="inline mr-0.5" />
            {dest.region}
          </span>
        </div>
      </GallerySlideshow>


      {/* Progress */}
      {attractions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold">Your Progress</span>
            <span className="text-muted-foreground">
              {totalVisited} / {attractions.length} attractions
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(totalVisited / attractions.length) * 100}%`, background: "hsl(var(--primary))" }} />
          </div>
        </div>
      )}

      {/* Visitor rating average */}
      <StarRatingDisplay siteSlug={dest.slug} />

      {/* Audio Guide (premium) — gated behind subscription */}
      <PaywallGate
        isLocked={(dest as any).isLocked || false}
        siteName={name}
        shopifyUrl={(dest as any).shopifyUrl}
      >
        <AudioPlayer site={dest} />
        <ItineraryCard siteSlug={dest.slug} centerLat={dest.lat} centerLng={dest.lng} />
      </PaywallGate>

      {/* Description — FREE forever as promised */}
      <div>
        <p className={`text-base leading-relaxed text-foreground transition-all ${
          showFullDesc ? "" : "line-clamp-4"
        }`}>{desc}</p>
        <button
          onClick={() => setShowFullDesc(v => !v)}
          className="mt-1.5 text-sm font-medium text-primary hover:underline"
        >
          {showFullDesc ? "Show less" : "Read more"}
        </button>
      </div>

      {/* Book with a guide */}
      <BookWithGuide shopifyUrl={(dest as any).shopifyUrl || ""} siteName={name} />

      {/* Attractions */}
      {attractions.length > 0 && (() => {
        // Build category list with counts for the filter pill bar
        const attrCats = Array.from(new Set(attractions.map(a => a.category))).sort();
        const countCat = (cat: string) => attractions.filter(a => a.category === cat).length;

        // Apply filter
        const visible = attrFilter === "all"
          ? attractions
          : attractions.filter(a => a.category === attrFilter);

        const catLabel = (c: string) => c.charAt(0).toUpperCase() + c.slice(1).replace("-", " ");

        return (
          <div>
            {/* Header row: title + view toggle */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                Attractions in {name}
                {attrFilter !== "all" && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({visible.length})
                  </span>
                )}
              </h2>
              {/* Grid / List toggle */}
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-2 transition-colors ${
                    viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                  aria-label="Grid view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-2 transition-colors ${
                    viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                  aria-label="List view"
                >
                  <List size={15} />
                </button>
              </div>
            </div>

            {/* Category filter pill bar — same pattern as map/SitesPage */}
            {attrCats.length > 1 && (
              <div
                className="flex gap-1.5 overflow-x-auto pb-2 mb-4"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {/* All pill */}
                <button
                  type="button"
                  onClick={() => setAttrFilter("all")}
                  className="flex items-center gap-1 shrink-0 transition-all duration-200"
                  style={{
                    padding: "5px 10px", borderRadius: "999px", fontSize: "12px",
                    fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
                    background: attrFilter === "all" ? "hsl(var(--primary))" : "hsl(var(--card))",
                    color: attrFilter === "all" ? "#fff" : "hsl(var(--foreground))",
                    border: attrFilter === "all" ? "1.5px solid transparent" : "1.5px solid hsl(var(--border))",
                    boxShadow: attrFilter === "all" ? "0 2px 8px rgba(192,57,43,0.25)" : "0 1px 3px rgba(0,0,0,0.08)",
                  }}
                >
                  <span>All</span>
                  {attrFilter !== "all" && (
                    <span style={{
                      marginLeft: 3, fontSize: 10, fontWeight: 700,
                      color: "hsl(var(--primary))",
                      background: "hsl(var(--primary)/0.1)",
                      borderRadius: "999px", padding: "0 5px", lineHeight: "16px",
                    }}>{attractions.length}</span>
                  )}
                </button>

                {/* Per-category pills */}
                {attrCats.map(cat => {
                  const active = attrFilter === cat;
                  const count = countCat(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAttrFilter(cat)}
                      className="flex items-center gap-1 shrink-0 transition-all duration-200"
                      style={{
                        padding: "5px 10px", borderRadius: "999px", fontSize: "12px",
                        fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
                        background: active ? "hsl(var(--primary))" : "hsl(var(--card))",
                        color: active ? "#fff" : "hsl(var(--foreground))",
                        border: active ? "1.5px solid transparent" : "1.5px solid hsl(var(--border))",
                        boxShadow: active ? "0 2px 8px rgba(192,57,43,0.25)" : "0 1px 3px rgba(0,0,0,0.08)",
                      }}
                    >
                      <span>{CATEGORY_EMOJI[cat] || "📍"}</span>
                      <span>{catLabel(cat)}</span>
                      {!active && (
                        <span style={{
                          marginLeft: 2, fontSize: 10, fontWeight: 700,
                          color: "hsl(var(--primary))",
                          background: "hsl(var(--primary)/0.1)",
                          borderRadius: "999px", padding: "0 5px", lineHeight: "16px",
                        }}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Grid view */}
            {viewMode === "grid" && (
              <div className="grid gap-4 sm:grid-cols-2">
                {visible.map(attr => {
                  const isVisited = visitedSiteIds.has(attr.id);
                  return (
                    <article key={attr.slug} data-testid={`attr-card-${attr.slug}`}
                      className="tour-card rounded-xl border border-border bg-card overflow-hidden cursor-pointer group"
                      onClick={() => navigate(`/sites/${params?.dest}/${attr.slug}`)}>
                      <div className="relative h-36 bg-muted overflow-hidden">
                        {attr.imageUrl ? (
                          <img src={attr.imageUrl} alt={attrName(attr)}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            {CATEGORY_EMOJI[attr.category] || "📍"}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        {isVisited && (
                          <div className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: "#2D7A22", color: "white" }}>
                            ✓ Visited
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                            style={{ background: CATEGORY_COLORS[attr.category] || "#C0392B" }}>
                            {CATEGORY_EMOJI[attr.category] || "📍"}{" "}{catLabel(attr.category)}
                          </span>
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-sm mb-1 leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                          {attrName(attr)}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{attrDesc(attr)}</p>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={10} /> {attr.visitDuration}m
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="points-badge"><Star size={8} fill="currentColor" /> {attr.points}</span>
                            <ChevronRight size={13} className="text-primary" />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* List view */}
            {viewMode === "list" && (
              <div className="space-y-2">
                {visible.map((attr, idx) => {
                  const isVisited = visitedSiteIds.has(attr.id);
                  return (
                    <article key={attr.slug} data-testid={`attr-list-${attr.slug}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card cursor-pointer hover:border-primary/40 transition-colors group"
                      onClick={() => navigate(`/sites/${params?.dest}/${attr.slug}`)}>
                      {/* Number */}
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: CATEGORY_COLORS[attr.category] || "#C0392B" }}>
                        {idx + 1}
                      </div>
                      {/* Thumbnail */}
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                        {attr.imageUrl ? (
                          <img src={attr.imageUrl} alt={attrName(attr)}
                            className="w-full h-full object-cover"
                            loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">
                            {CATEGORY_EMOJI[attr.category] || "📍"}
                          </div>
                        )}
                      </div>
                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                            style={{ background: CATEGORY_COLORS[attr.category] || "#C0392B" }}>
                            {CATEGORY_EMOJI[attr.category]} {catLabel(attr.category)}
                          </span>
                          {isVisited && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#2D7A22", color: "white" }}>✓ Visited</span>
                          )}
                        </div>
                        <p className="font-semibold text-sm leading-tight truncate">{attrName(attr)}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{attrDesc(attr)}</p>
                      </div>
                      {/* Meta */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="points-badge text-[10px]"><Star size={8} fill="currentColor" /> {attr.points}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock size={9}/>{attr.visitDuration}m</span>
                        <ChevronRight size={13} className="text-primary" />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Empty filter state */}
            {visible.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No attractions in this category.
                <button onClick={() => setAttrFilter("all")} className="ml-2 text-primary underline">Show all</button>
              </div>
            )}
          </div>
        );
      })()}

      {attractions.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center text-muted-foreground">
          <Lightbulb size={28} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Attractions coming soon.</p>
        </div>
      )}

      {/* Mini-map + Get Directions */}
      <div className="rounded-xl border border-border overflow-hidden">
        <MiniMap lat={dest.lat} lng={dest.lng} label={name} />
        <a href={`https://www.google.com/maps?q=${dest.lat},${dest.lng}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 text-sm text-primary hover:bg-muted transition-colors border-t border-border">
          <Navigation size={14} />
          {`Get Directions to ${name}`}
        </a>
      </div>

      <BackToTop />
    </div>
  );
}
