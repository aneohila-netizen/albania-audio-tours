import { useRoute, useLocation } from "wouter";
import { useApp } from "@/App";
import { useQuery } from "@tanstack/react-query";
import type { TourSite, Attraction } from "@shared/schema";
import { railwayFetch } from "@/lib/queryClient";
import AudioPlayer from "@/components/AudioPlayer";
import VisitModal from "@/components/VisitModal";
import MiniMap from "@/components/MiniMap";
import { useState } from "react";
import { Clock, Star, Lightbulb, Navigation, ChevronRight, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getSessionId } from "@/lib/session";
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
  castle: "🏰", mosque: "🕌", museum: "🖼️", district: "🏡",
  church: "⛪", promenade: "🌊", monument: "🗿", market: "🛍️",
  "hot-springs": "♨️", ruins: "🏚️", archaeology: "🏛️",
  beach: "🏖️", nature: "🏔️", mountain: "⛰️", lake: "🏞️", landmark: "📍",
};

export default function AttractionDetailPage() {
  const [, params] = useRoute("/sites/:dest/:attr");
  const [, navigate] = useLocation();
  const { lang, visitedSiteIds, markVisited } = useApp();
  const [showModal, setShowModal] = useState(false);

  // Fetch destination directly from Railway (bypasses Perplexity proxy)
  const { data: dest } = useQuery<TourSite>({
    queryKey: ["railway", "sites", params?.dest],
    queryFn: () => railwayFetch<TourSite>(`/api/sites/${params?.dest}`),
    enabled: !!params?.dest,
  });

  // Fetch attraction directly from Railway (bypasses Perplexity proxy)
  const { data: attraction, isLoading } = useQuery<Attraction>({
    queryKey: ["railway", "attractions", params?.dest, params?.attr],
    queryFn: () => railwayFetch<Attraction>(`/api/attractions/${params?.dest}/${params?.attr}`),
    enabled: !!params?.dest && !!params?.attr,
  });

  const handleMarkVisited = async () => {
    if (!attraction || visitedSiteIds.has(attraction.id)) return;
    markVisited(attraction.id, attraction.points);
    setShowModal(true);
    try {
      await apiRequest("POST", "/api/progress", {
        sessionId: getSessionId(),
        siteId: attraction.id,
        visitedAt: new Date().toISOString(),
        pointsEarned: attraction.points,
        audioCompleted: false,
      });
    } catch (_) {}
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!attraction) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
        <p className="font-semibold">Attraction not found</p>
        <button
          onClick={() => navigate(params?.dest ? `/sites/${params.dest}` : "/sites")}
          className="mt-4 text-primary underline text-sm"
        >Back</button>
      </div>
    );
  }

  const aName = lang === "al" ? attraction.nameAl : lang === "gr" ? attraction.nameGr : attraction.nameEn;
  const aDesc = lang === "al" ? attraction.descAl : lang === "gr" ? attraction.descGr : attraction.descEn;
  const aFunFact = lang === "al" ? attraction.funFactAl : lang === "gr" ? attraction.funFactGr : attraction.funFactEn;
  const destName = dest ? (lang === "al" ? dest.nameAl : lang === "gr" ? dest.nameGr : dest.nameEn) : params?.dest;
  const isVisited = visitedSiteIds.has(attraction.id);
  const destRegion = dest?.region || params?.dest || "";

  const siteCompat: TourSite = {
    id: attraction.id,
    slug: attraction.slug,
    nameEn: attraction.nameEn,
    nameAl: attraction.nameAl,
    nameGr: attraction.nameGr,
    descEn: attraction.descEn,
    descAl: attraction.descAl,
    descGr: attraction.descGr,
    funFactEn: attraction.funFactEn || null,
    funFactAl: attraction.funFactAl || null,
    funFactGr: attraction.funFactGr || null,
    category: attraction.category,
    difficulty: "easy",
    region: destRegion,
    lat: attraction.lat,
    lng: attraction.lng,
    imageUrl: attraction.imageUrl || null,
    audioUrlEn: attraction.audioUrlEn || null,
    audioUrlAl: attraction.audioUrlAl || null,
    audioUrlGr: attraction.audioUrlGr || null,
    visitDuration: attraction.visitDuration,
    points: attraction.points,
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6" data-testid="attraction-detail">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
        <button onClick={() => navigate("/sites")} className="hover:text-foreground transition-colors">
          {lang === "al" ? "Destinacionet" : lang === "gr" ? "Προορισμοί" : "Destinations"}
        </button>
        <ChevronRight size={13} />
        <button onClick={() => navigate(`/sites/${params?.dest}`)} className="hover:text-foreground transition-colors">
          {destName}
        </button>
        <ChevronRight size={13} />
        <span className="text-foreground font-medium truncate max-w-[140px]">{aName}</span>
      </div>

      {/* Hero image */}
      {attraction.imageUrl && (
        <div className="rounded-2xl overflow-hidden h-64 bg-muted">
          <img src={attraction.imageUrl} alt={aName} className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      {!attraction.imageUrl && (
        <div className="rounded-2xl h-48 bg-muted flex items-center justify-center">
          <span className="text-4xl">{CATEGORY_EMOJI[attraction.category] || "📍"}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
            style={{ background: CATEGORY_COLORS[attraction.category] || "#C0392B" }}>
            {CATEGORY_EMOJI[attraction.category] || "📍"}{" "}
            {attraction.category.charAt(0).toUpperCase() + attraction.category.slice(1).replace("-", " ")}
          </span>
          {isVisited && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#2D7A22" }}>
              ✓ {lang === "al" ? "Vizituar" : lang === "gr" ? "Επισκέφθηκα" : "Visited"}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold leading-tight mb-2" style={{ fontFamily: "var(--font-display)" }}>
          {aName}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin size={14} /> {destRegion}</span>
          <span className="flex items-center gap-1"><Clock size={14} /> {attraction.visitDuration} {lang === "al" ? "min vizitë" : lang === "gr" ? "λεπτά" : "min visit"}</span>
          <span className="flex items-center gap-1">
            <Star size={14} fill="currentColor" style={{ color: "var(--color-gold)" }} />
            {attraction.points} {lang === "al" ? "pikë" : lang === "gr" ? "πόντοι" : "points"}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="prose prose-sm max-w-none">
        <p className="text-base leading-relaxed text-foreground">{aDesc}</p>
      </div>

      {/* Audio player */}
      <AudioPlayer site={siteCompat} onComplete={() => { if (!isVisited) handleMarkVisited(); }} />

      {/* Fun fact */}
      {aFunFact && (
        <div className="rounded-xl border border-border bg-muted/50 p-4" data-testid="fun-fact">
          <div className="flex items-start gap-3">
            <Lightbulb size={18} style={{ color: "var(--color-gold)", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <p className="font-semibold text-sm mb-1">
                {lang === "al" ? "A e Dinit?" : lang === "gr" ? "Γνωρίζατε ότι;" : "Did You Know?"}
              </p>
              <p className="text-sm text-muted-foreground">{aFunFact}</p>
            </div>
          </div>
        </div>
      )}

      {/* Mini-map */}
      <div className="rounded-xl border border-border overflow-hidden" data-testid="mini-map">
        <MiniMap lat={attraction.lat} lng={attraction.lng} label={aName} />
        <a href={`https://www.google.com/maps?q=${attraction.lat},${attraction.lng}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 text-sm text-primary hover:bg-muted transition-colors border-t border-border">
          <Navigation size={14} />
          {lang === "al" ? "Merr Udhëzimet" : lang === "gr" ? "Λήψη Oδηγιών" : "Get Directions"}
        </a>
      </div>

      {/* Mark visited */}
      <button data-testid="mark-visited-btn" onClick={handleMarkVisited} disabled={isVisited}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
        style={{ background: isVisited ? "hsl(var(--muted))" : "hsl(var(--primary))", color: isVisited ? "hsl(var(--muted-foreground))" : "hsl(var(--primary-foreground))" }}>
        {isVisited
          ? (lang === "al" ? "Vizituar ✓" : lang === "gr" ? "Επισκέφθηκα ✓" : "Visited ✓")
          : (lang === "al" ? "Shëno si Vizituar" : lang === "gr" ? "Σήμανση ως Επισκέφθηκα" : "Mark as Visited")}
      </button>

      {showModal && <VisitModal site={siteCompat} onClose={() => setShowModal(false)} />}
    </div>
  );
}
