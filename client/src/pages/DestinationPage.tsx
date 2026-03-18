import { useRoute, useLocation } from "wouter";
import { useApp } from "@/App";
import { useQuery } from "@tanstack/react-query";
import type { TourSite, Attraction } from "@shared/schema";
import { ArrowLeft, MapPin, Star, Clock, ChevronRight, Lightbulb } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { lang, visitedSiteIds } = useApp();

  // Fetch destination from API
  const { data: dest, isLoading: destLoading } = useQuery<TourSite>({
    queryKey: ["/api/sites", params?.dest],
    enabled: !!params?.dest,
  });

  // Fetch attractions for this destination from API
  const { data: attractions = [], isLoading: attrsLoading } = useQuery<Attraction[]>({
    queryKey: ["/api/attractions", params?.dest],
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

  const name = lang === "al" ? dest.nameAl : lang === "gr" ? dest.nameGr : dest.nameEn;
  // Use funFactEn as tagline if no dedicated field (destinations use descEn as tagline in staticData)
  const desc = lang === "al" ? dest.descAl : lang === "gr" ? dest.descGr : dest.descEn;
  // Derive tagline: first sentence of description
  const tagline = desc.split(".")[0];

  const attrName = (a: Attraction) => lang === "al" ? a.nameAl : lang === "gr" ? a.nameGr : a.nameEn;
  const attrDesc = (a: Attraction) => lang === "al" ? a.descAl : lang === "gr" ? a.descGr : a.descEn;
  const totalVisited = attractions.filter(a => visitedSiteIds.has(a.id)).length;
  const totalAttrPoints = attractions.reduce((s, a) => s + a.points, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Back */}
      <button data-testid="back-btn" onClick={() => navigate("/sites")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={16} />
        {lang === "al" ? "Kthehu te Destinacionet" : lang === "gr" ? "Πίσω στους Προορισμούς" : "All Destinations"}
      </button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden h-64 bg-muted">
        {dest.imageUrl && (
          <img src={dest.imageUrl} alt={name} className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h1 className="text-3xl font-bold text-white mb-1 leading-tight drop-shadow-lg" style={{ fontFamily: "var(--font-display)" }}>
            {name}
          </h1>
          <p className="text-sm text-white/80 italic">{tagline}</p>
        </div>
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
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
      </div>

      {/* Progress */}
      {attractions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold">{lang === "al" ? "Progresi juaj" : lang === "gr" ? "Η πρόοδός σας" : "Your Progress"}</span>
            <span className="text-muted-foreground">
              {totalVisited} / {attractions.length} {lang === "al" ? "atraksione" : lang === "gr" ? "αξιοθέατα" : "attractions"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(totalVisited / attractions.length) * 100}%`, background: "hsl(var(--primary))" }} />
          </div>
        </div>
      )}

      {/* Description */}
      <div className="prose prose-sm max-w-none">
        <p className="text-base leading-relaxed text-foreground">{desc}</p>
      </div>

      {/* Attractions */}
      {attractions.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-display)" }}>
            {lang === "al" ? `Atraksionet e ${name}` : lang === "gr" ? `Αξιοθέατα στο ${name}` : `Attractions in ${name}`}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {attractions.map(attr => {
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
                        ✓ {lang === "al" ? "Vizituar" : lang === "gr" ? "Επισκέφθηκα" : "Visited"}
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ background: CATEGORY_COLORS[attr.category] || "#C0392B" }}>
                        {CATEGORY_EMOJI[attr.category] || "📍"}{" "}
                        {attr.category.charAt(0).toUpperCase() + attr.category.slice(1).replace("-", " ")}
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
        </div>
      )}

      {attractions.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center text-muted-foreground">
          <Lightbulb size={28} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{lang === "al" ? "Atraksionet po shtohen së shpejti." : lang === "gr" ? "Αξιοθέατα σύντομα." : "Attractions coming soon."}</p>
        </div>
      )}

      {/* Maps link */}
      <a href={`https://www.google.com/maps?q=${dest.lat},${dest.lng}`} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 p-3 rounded-xl border border-border text-sm text-primary hover:bg-muted transition-colors">
        <MapPin size={14} />
        {lang === "al" ? `Hap ${name} në Google Maps` : lang === "gr" ? `Άνοιγμα ${name} στο Google Maps` : `Open ${name} in Google Maps`}
      </a>
    </div>
  );
}
