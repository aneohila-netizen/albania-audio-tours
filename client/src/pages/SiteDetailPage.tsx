import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useApp } from "@/App";
import type { TourSite } from "@shared/schema";
import AudioPlayer from "@/components/AudioPlayer";
import VisitModal from "@/components/VisitModal";
import { useState } from "react";
import { ArrowLeft, MapPin, Clock, Star, Lightbulb, Navigation } from "lucide-react";
import { STATIC_SITES } from "@/lib/staticData";
import { apiRequest } from "@/lib/queryClient";
import { getSessionId } from "@/lib/session";

const CATEGORY_COLORS: Record<string, string> = {
  archaeology: "#8B4513",
  castle: "#4A4A6A",
  beach: "#0A6E8C",
  nature: "#2D7A22",
  "historic-town": "#8B6914",
};

export default function SiteDetailPage() {
  const [, params] = useRoute("/sites/:slug");
  const [, navigate] = useLocation();
  const { t, lang, visitedSiteIds, markVisited } = useApp();
  const [showModal, setShowModal] = useState(false);

  const { data: site, isLoading } = useQuery<TourSite>({
    queryKey: ["/api/sites", params?.slug],
    queryFn: async () => {
      const staticSite = STATIC_SITES.find(s => s.slug === params?.slug);
      if (staticSite) return staticSite;
      const res = await fetch(`/api/sites/${params?.slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    initialData: () => STATIC_SITES.find(s => s.slug === params?.slug),
    enabled: !!params?.slug,
    retry: false,
  });

  const handleMarkVisited = async () => {
    if (!site || visitedSiteIds.has(site.id)) return;
    markVisited(site.id, site.points);
    setShowModal(true);
    try {
      await apiRequest("POST", "/api/progress", {
        sessionId: getSessionId(),
        siteId: site.id,
        visitedAt: new Date().toISOString(),
        pointsEarned: site.points,
        audioCompleted: false,
      });
    } catch (_) {}
  };

  const handleAudioComplete = () => {
    if (site && !visitedSiteIds.has(site.id)) {
      handleMarkVisited();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="skeleton h-8 w-1/3" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-6 w-2/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
        <p className="font-semibold">Site not found</p>
        <button onClick={() => navigate("/sites")} className="mt-4 text-primary underline text-sm">
          Back to Sites
        </button>
      </div>
    );
  }

  const name = lang === "al" ? site.nameAl : lang === "gr" ? site.nameGr : site.nameEn;
  const desc = lang === "al" ? site.descAl : lang === "gr" ? site.descGr : site.descEn;
  const funFact = lang === "al" ? site.funFactAl : lang === "gr" ? site.funFactGr : site.funFactEn;
  const isVisited = visitedSiteIds.has(site.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6" data-testid="site-detail">
      {/* Back button */}
      <button
        data-testid="back-btn"
        onClick={() => navigate("/sites")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        {t.backToMap}
      </button>

      {/* Hero image */}
      {site.imageUrl && (
        <div className="rounded-2xl overflow-hidden h-64 bg-muted">
          <img
            src={site.imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
            style={{ background: CATEGORY_COLORS[site.category] || "#C0392B" }}
          >
            {t.categories[site.category as keyof typeof t.categories]}
          </span>
          <span className={`text-xs font-medium diff-${site.difficulty}`}>
            ● {t.difficulty[site.difficulty as keyof typeof t.difficulty]}
          </span>
          {isVisited && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#2D7A22" }}>
              ✓ {t.alreadyVisited}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold leading-tight mb-2" style={{ fontFamily: "var(--font-display)" }}>
          {name}
        </h1>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin size={14} />{site.region}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} />{site.visitDuration} {t.minuteRead}
          </span>
          <span className="flex items-center gap-1">
            <Star size={14} fill="currentColor" style={{ color: "var(--color-gold)" }} />
            {site.points} {t.points}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="prose prose-sm max-w-none">
        <p className="text-base leading-relaxed text-muted-foreground">{desc}</p>
      </div>

      {/* Audio player */}
      <AudioPlayer site={site} onComplete={handleAudioComplete} />

      {/* Fun fact */}
      {funFact && (
        <div className="rounded-xl border border-border bg-muted/50 p-4" data-testid="fun-fact">
          <div className="flex items-start gap-3">
            <Lightbulb size={18} style={{ color: "var(--color-gold)", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <p className="font-semibold text-sm mb-1">{t.funFact}</p>
              <p className="text-sm text-muted-foreground">{funFact}</p>
            </div>
          </div>
        </div>
      )}

      {/* Map mini preview */}
      <div className="rounded-xl border border-border overflow-hidden" data-testid="mini-map">
        {/* Static map image via OpenStreetMap tile — avoids iframe referer block */}
        <a
          href={`https://www.google.com/maps?q=${site.lat},${site.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative"
        >
          <img
            src={`https://maps.geoapify.com/v1/staticmap?style=osm-carto&width=600&height=200&center=lonlat:${site.lng},${site.lat}&zoom=13&marker=lonlat:${site.lng},${site.lat};color:%23C0392B;size:medium&apiKey=YOUR_KEY`}
            alt={`Map of ${name}`}
            style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }}
            onError={(e) => {
              // Fallback: show a styled placeholder with coordinates
              const el = e.currentTarget;
              el.style.display = "none";
              const parent = el.parentElement;
              if (parent) {
                parent.innerHTML = `<div style="width:100%;height:200px;background:hsl(var(--muted));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;"><span style="font-size:2rem">📍</span><span style="font-size:0.8rem;color:hsl(var(--muted-foreground))">${site.lat.toFixed(4)}, ${site.lng.toFixed(4)}</span></div>`;
              }
            }}
          />
        </a>
        <a
          href={`https://www.google.com/maps?q=${site.lat},${site.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 text-sm text-primary hover:bg-muted transition-colors border-t border-border"
        >
          <Navigation size={14} />
          Get Directions
        </a>
      </div>

      {/* Mark visited CTA */}
      <button
        data-testid="mark-visited-detail-btn"
        onClick={handleMarkVisited}
        disabled={isVisited}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
        style={{
          background: isVisited ? "hsl(var(--muted))" : "hsl(var(--primary))",
          color: isVisited ? "hsl(var(--muted-foreground))" : "hsl(var(--primary-foreground))",
        }}
      >
        {isVisited ? t.alreadyVisited : t.markVisited}
      </button>

      {showModal && (
        <VisitModal site={site} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
