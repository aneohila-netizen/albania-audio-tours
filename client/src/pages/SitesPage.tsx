import { useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/App";
import { useDestinations, useAttractions } from "@/lib/useApiData";
import type { Destination } from "@/lib/staticData";
import { Search, MapPin, Star, ChevronRight, LayoutGrid, List } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  city: "#C0392B",
  archaeology: "#8B4513",
  castle: "#4A4A6A",
  beach: "#0A6E8C",
  nature: "#2D7A22",
  "historic-town": "#8B6914",
  mountain: "#5A4A78",
  lake: "#1A6B9A",
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
};

function catLabel(cat: string) {
  return cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " ");
}

export default function SitesPage() {
  const [, navigate] = useLocation();
  const { lang } = useApp();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const name = (d: Destination) =>
    lang === "al" ? d.nameAl : lang === "gr" ? d.nameGr : d.nameEn;
  const tagline = (d: Destination) =>
    lang === "al" ? d.taglineAl : lang === "gr" ? d.taglineGr : d.taglineEn;
  const desc = (d: Destination) =>
    lang === "al" ? d.descAl : lang === "gr" ? d.descGr : d.descEn;

  const DESTINATIONS = useDestinations();
  const ATTRACTIONS = useAttractions();

  const categories = ["all", ...Array.from(new Set(DESTINATIONS.map(d => d.category)))];

  const filtered = DESTINATIONS.filter(d => {
    const n = name(d).toLowerCase();
    const tl = tagline(d).toLowerCase();
    const q = search.toLowerCase();
    return (
      (q === "" || n.includes(q) || tl.includes(q)) &&
      (filterCat === "all" || d.category === filterCat)
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            {lang === "al" ? "Destinacionet" : lang === "gr" ? "Προορισμοί" : "Destinations"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "al"
              ? `${filtered.length} destinacione për të zbuluar`
              : lang === "gr"
              ? `${filtered.length} προορισμοί για εξερεύνηση`
              : `${filtered.length} destinations to explore`}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 mt-1">
          <button
            data-testid="view-grid"
            onClick={() => setViewMode("grid")}
            title="Grid view"
            className={`p-2 rounded-lg transition-colors ${
              viewMode === "grid"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            data-testid="view-list"
            onClick={() => setViewMode("list")}
            title="List view"
            className={`p-2 rounded-lg transition-colors ${
              viewMode === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            data-testid="search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={
              lang === "al"
                ? "Kërko destinacione..."
                : lang === "gr"
                ? "Αναζήτηση προορισμών..."
                : "Search destinations..."
            }
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              data-testid={`filter-${cat}`}
              onClick={() => setFilterCat(cat)}
              className={`flex-none px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                filterCat === cat
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50"
              }`}
            >
              {cat === "all" ? (
                lang === "al" ? "Të Gjitha" : lang === "gr" ? "Όλα" : "All"
              ) : (
                <>{CATEGORY_EMOJI[cat] || "📍"} {catLabel(cat)}</>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── GRID VIEW ── */}
      {viewMode === "grid" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(dest => {
            const attrCount = ATTRACTIONS.filter(a => a.destinationSlug === dest.slug).length;
            return (
              <article
                key={dest.slug}
                data-testid={`dest-card-${dest.slug}`}
                className="tour-card rounded-2xl border border-border bg-card overflow-hidden cursor-pointer group"
                onClick={() => navigate(`/sites/${dest.slug}`)}
              >
                <div className="relative h-48 bg-muted overflow-hidden">
                  {dest.imageUrl && (
                    <img
                      src={dest.imageUrl}
                      alt={name(dest)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ background: CATEGORY_COLORS[dest.category] || "#C0392B" }}
                    >
                      {CATEGORY_EMOJI[dest.category] || "📍"} {catLabel(dest.category)}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="points-badge">
                      <Star size={9} fill="currentColor" />
                      {dest.totalPoints}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h2 className="font-bold text-lg text-white leading-tight drop-shadow-sm" style={{ fontFamily: "var(--font-display)" }}>
                      {name(dest)}
                    </h2>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3 italic leading-snug">
                    {tagline(dest)}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {dest.region}
                      </span>
                      {attrCount > 0 && (
                        <span className="flex items-center gap-1">
                          📍 {attrCount} {lang === "al" ? "vende" : lang === "gr" ? "μέρη" : "places"}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                      {lang === "al" ? "Eksploro" : lang === "gr" ? "Εξερεύνηση" : "Explore"}
                      <ChevronRight size={13} />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === "list" && (
        <div className="flex flex-col gap-3">
          {filtered.map((dest, idx) => {
            const attrCount = ATTRACTIONS.filter(a => a.destinationSlug === dest.slug).length;
            return (
              <article
                key={dest.slug}
                data-testid={`dest-list-${dest.slug}`}
                className="tour-card rounded-xl border border-border bg-card overflow-hidden cursor-pointer group flex items-stretch"
                onClick={() => navigate(`/sites/${dest.slug}`)}
              >
                {/* Thumbnail */}
                <div className="relative w-28 sm:w-36 flex-none bg-muted overflow-hidden">
                  {dest.imageUrl && (
                    <img
                      src={dest.imageUrl}
                      alt={name(dest)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  {/* Row number */}
                  <div className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: "rgba(0,0,0,0.5)" }}>
                    {idx + 1}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ background: CATEGORY_COLORS[dest.category] || "#C0392B" }}
                      >
                        {CATEGORY_EMOJI[dest.category] || "📍"} {catLabel(dest.category)}
                      </span>
                      <span className="points-badge">
                        <Star size={8} fill="currentColor" />
                        {dest.totalPoints}
                      </span>
                    </div>
                    <h2 className="font-bold text-base leading-tight mb-1" style={{ fontFamily: "var(--font-display)" }}>
                      {name(dest)}
                    </h2>
                    <p className="text-xs text-muted-foreground italic leading-snug line-clamp-1 mb-1.5">
                      {tagline(dest)}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed hidden sm:block">
                      {desc(dest)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin size={10} /> {dest.region}
                      </span>
                      {attrCount > 0 && (
                        <span>
                          📍 {attrCount} {lang === "al" ? "vende" : lang === "gr" ? "μέρη" : "places"}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary whitespace-nowrap">
                      {lang === "al" ? "Eksploro" : lang === "gr" ? "Εξερεύνηση" : "Explore"}
                      <ChevronRight size={13} />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Search size={40} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium">
            {lang === "al" ? "Asnjë destinacion nuk u gjet" : lang === "gr" ? "Δεν βρέθηκαν προορισμοί" : "No destinations found"}
          </p>
          <p className="text-sm">
            {lang === "al" ? "Provo një kërkim tjetër" : lang === "gr" ? "Δοκιμάστε άλλη αναζήτηση" : "Try a different search or filter"}
          </p>
        </div>
      )}
    </div>
  );
}
