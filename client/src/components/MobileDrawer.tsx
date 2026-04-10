/**
 * MobileDrawer — Google Maps-style slide-up bottom sheet (mobile only).
 *
 * Layout (bottom → top when expanded):
 *   ┌───────────────────────────────────┐  ← fixed bottom nav (48px)
 *   │  ▬ drag handle                    │  ← always visible (collapsed: 28px tall)
 *   │  ── nearest destination CTA ──    │  ← visible when expanded
 *   │  footer links row                 │
 *   └───────────────────────────────────┘
 *
 * Two snap positions:
 *   COLLAPSED: only the handle + slim peek bar (~28px)
 *   EXPANDED:  full content (~200px)
 *
 * Touch drag and pointer drag both supported.
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";

interface Destination {
  slug: string;
  nameEn: string;
  imageUrl?: string;
  category?: string;
}

interface Props {
  nearestTour: { slug: string; name: string; distM: number } | null;
  destinations: Destination[];
  cmsLinks?: { id: number; slug: string; title: string }[];
}

const COLLAPSED_H = 28;   // px — just the handle bar
const EXPANDED_H  = 280;  // px — handle + larger CTA card + footer links (C3: increased from 210)

export default function MobileDrawer({ nearestTour, destinations, cmsLinks = [] }: Props) {
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const dragStart  = useRef<{ y: number; startH: number } | null>(null);
  const [currentH, setCurrentH] = useState(COLLAPSED_H);
  const drawerRef  = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Snap to nearest position on drag end
  const snapTo = useCallback((open: boolean) => {
    setExpanded(open);
    setCurrentH(open ? EXPANDED_H : COLLAPSED_H);
    isDragging.current = false;
  }, []);

  // Touch start
  const onTouchStart = (e: React.TouchEvent) => {
    dragStart.current = { y: e.touches[0].clientY, startH: currentH };
    isDragging.current = true;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragStart.current) return;
    const dy = dragStart.current.y - e.touches[0].clientY;
    const h  = Math.max(COLLAPSED_H, Math.min(EXPANDED_H, dragStart.current.startH + dy));
    setCurrentH(h);
  };
  const onTouchEnd = () => {
    if (!dragStart.current) return;
    const mid = (COLLAPSED_H + EXPANDED_H) / 2;
    snapTo(currentH > mid);
    dragStart.current = null;
  };

  // Pointer (mouse) drag for desktop testing
  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = { y: e.clientY, startH: currentH };
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current || !isDragging.current) return;
    const dy = dragStart.current.y - e.clientY;
    const h  = Math.max(COLLAPSED_H, Math.min(EXPANDED_H, dragStart.current.startH + dy));
    setCurrentH(h);
  };
  const onPointerUp = () => {
    if (!dragStart.current) return;
    const mid = (COLLAPSED_H + EXPANDED_H) / 2;
    snapTo(currentH > mid);
    dragStart.current = null;
  };

  // Resolve featured destination
  const featuredSlug = nearestTour?.slug || "tirana";
  const featuredDest = destinations.find(d => d.slug === featuredSlug)
    || destinations.find(d => d.slug === "tirana")
    || destinations[0];
  const featuredName = nearestTour?.name || featuredDest?.nameEn || "Tirana";
  const featuredImg  = featuredDest?.imageUrl || "";
  const hasGPS       = !!nearestTour;

  const distKm = nearestTour && nearestTour.distM < 999999
    ? (nearestTour.distM / 1000).toFixed(1)
    : null;

  const handleExplore = () => {
    navigate(`/sites/${featuredSlug}`);
    snapTo(false);
  };

  const progress = (currentH - COLLAPSED_H) / (EXPANDED_H - COLLAPSED_H); // 0→1

  return (
    <div
      ref={drawerRef}
      className="md:hidden fixed left-0 right-0 z-[1900] bg-card border-t border-border/60 rounded-t-2xl shadow-2xl"
      style={{
        bottom: "var(--bottom-nav-h, 56px)",
        height: `${currentH}px`,
        transition: isDragging.current ? "none" : "height 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        overflow: "hidden",
        willChange: "height",
      }}
      data-mobile-drawer
    >
      {/* ── Drag handle area ─────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => !isDragging.current && snapTo(!expanded)}
        aria-label={expanded ? "Collapse drawer" : "Expand drawer"}
        role="button"
        tabIndex={0}
      >
        {/* Handle pill — matches Google Maps style */}
        <div
          className="rounded-full bg-muted-foreground/30"
          style={{ width: 36, height: 4 }}
        />
      </div>

      {/* ── Content (fades in as drawer opens) ───────────────────────── */}
      <div
        style={{
          opacity: Math.min(1, progress * 2.5),
          transform: `translateY(${(1 - progress) * 12}px)`,
          transition: isDragging.current ? "none" : "opacity 0.22s ease, transform 0.22s ease",
          padding: "0 12px 10px",
          pointerEvents: progress < 0.3 ? "none" : "auto",
        }}
      >
        {/* ── Nearest destination CTA card ─────────────────────────── */}
        {featuredDest && (
          <div
            className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 mb-3 cursor-pointer active:bg-muted transition-colors"
            onClick={handleExplore}
          >
            {/* Thumbnail */}
            {featuredImg ? (
              <img
                src={featuredImg}
                alt={featuredName}
                className="w-20 h-20 rounded-xl object-cover shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-3xl">
                🇦🇱
              </div>
            )}
            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-0.5">
                {hasGPS
                  ? distKm ? `📍 Nearest · ${distKm} km away` : "📍 Nearest destination"
                  : "🇦🇱 Start exploring Albania"}
              </p>
              <p className="text-sm font-bold truncate">{featuredName}</p>
              <p className="text-[11px] text-muted-foreground">
                Audio tours · attractions · history
              </p>
            </div>
            {/* Arrow */}
            <ChevronRight size={18} className="text-primary shrink-0" />
          </div>
        )}

        {/* ── Footer links ─────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5" style={{ fontSize: 11 }}>
          <a href="#/blog"          className="text-muted-foreground hover:text-primary transition-colors">Blog</a>
          <a href="#/subscriptions" className="font-semibold hover:text-primary transition-colors" style={{ color: "hsl(var(--primary))" }}>Subscribe</a>
          {cmsLinks.map(p => (
            <a key={p.id} href={`#/p/${p.slug}`} className="text-muted-foreground hover:text-primary transition-colors">{p.title}</a>
          ))}
          <a href="#/contact"       className="text-muted-foreground hover:text-primary transition-colors">Contact</a>
          <a href="#/terms"         className="text-muted-foreground hover:text-primary transition-colors">Terms</a>
        </div>
      </div>
    </div>
  );
}
