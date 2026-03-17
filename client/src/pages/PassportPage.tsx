import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/App";
import type { TourSite } from "@shared/schema";
import { BookOpen, Star, Award } from "lucide-react";
import { STATIC_SITES } from "@/lib/staticData";

const BADGE_MILESTONES = [
  { count: 1, label: "First Steps", emoji: "🦅", desc: "Visited your first Albanian site" },
  { count: 3, label: "Explorer", emoji: "🗺️", desc: "Explored 3 different sites" },
  { count: 5, label: "Adventurer", emoji: "⛺", desc: "Conquered 5 sites" },
  { count: 8, label: "Scholar", emoji: "🏛️", desc: "Mastered all 8 sites" },
];

const STAMP_EMOJI: Record<string, string> = {
  archaeology: "🏛️",
  castle: "🏰",
  beach: "🏖️",
  nature: "🏔️",
  "historic-town": "🏘️",
};

const STAMP_COLORS: Record<string, string> = {
  archaeology: "#8B4513",
  castle: "#4A4A6A",
  beach: "#0A6E8C",
  nature: "#2D7A22",
  "historic-town": "#8B6914",
};

export default function PassportPage() {
  const { t, lang, visitedSiteIds, totalPoints } = useApp();

  const { data: sites = STATIC_SITES } = useQuery<TourSite[]>({
    queryKey: ["/api/sites"],
    initialData: STATIC_SITES,
    retry: false,
  });

  const visitedCount = visitedSiteIds.size;
  const nextBadge = BADGE_MILESTONES.find(b => b.count > visitedCount);
  const earnedBadges = BADGE_MILESTONES.filter(b => b.count <= visitedCount);

  const name = (s: TourSite) => lang === "al" ? s.nameAl : lang === "gr" ? s.nameGr : s.nameEn;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6" data-testid="passport-page">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ background: "linear-gradient(135deg, #C0392B, #922B21)" }}>
          <BookOpen size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {t.passportTitle}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t.passportSubtitle}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
            {visitedCount}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{t.visitedSites}</div>
          <div className="text-xs text-muted-foreground">of {sites.length} total</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-gold)" }}>
            {totalPoints}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{t.totalPoints}</div>
          <div className="text-xs text-muted-foreground">Explorer XP</div>
        </div>
      </div>

      {/* XP Progress */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold">{t.xpProgress}</span>
          {nextBadge && (
            <span className="text-xs text-muted-foreground">
              {t.nextBadge} {nextBadge.count} sites
            </span>
          )}
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min((visitedCount / sites.length) * 100, 100)}%`,
              background: "linear-gradient(90deg, hsl(var(--primary)), #E8B84B)",
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{visitedCount} visited</span>
          <span>{sites.length} total</span>
        </div>
      </div>

      {/* Earned badges */}
      {earnedBadges.length > 0 && (
        <div>
          <h2 className="font-bold text-base mb-3 flex items-center gap-2">
            <Award size={16} style={{ color: "var(--color-gold)" }} />
            Earned Badges
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {earnedBadges.map(badge => (
              <div
                key={badge.label}
                data-testid={`badge-${badge.label}`}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
              >
                <span className="text-3xl">{badge.emoji}</span>
                <div>
                  <div className="font-semibold text-sm">{badge.label}</div>
                  <div className="text-xs text-muted-foreground">{badge.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next badge */}
      {nextBadge && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 flex items-center gap-3">
          <span className="text-3xl opacity-30">{nextBadge.emoji}</span>
          <div>
            <div className="font-semibold text-sm text-muted-foreground">{nextBadge.label}</div>
            <div className="text-xs text-muted-foreground">{nextBadge.count - visitedCount} more sites to unlock</div>
          </div>
        </div>
      )}

      {/* Stamps grid */}
      <div>
        <h2 className="font-bold text-base mb-3 flex items-center gap-2">
          <Star size={16} style={{ color: "var(--color-gold)" }} />
          {t.stampsEarned} — {visitedCount}
        </h2>

        <div className="grid grid-cols-4 gap-3">
          {sites.map(site => {
            const isVisited = visitedSiteIds.has(site.id);
            return (
              <div
                key={site.id}
                data-testid={`stamp-${site.slug}`}
                className="relative aspect-square rounded-xl flex flex-col items-center justify-center gap-1 border-2 transition-all"
                style={{
                  borderStyle: isVisited ? "solid" : "dashed",
                  borderColor: isVisited ? STAMP_COLORS[site.category] : "hsl(var(--border))",
                  background: isVisited ? `${STAMP_COLORS[site.category]}15` : "transparent",
                  opacity: isVisited ? 1 : 0.4,
                }}
              >
                {isVisited && (
                  <div
                    className="passport-stamp absolute inset-0 flex items-center justify-center flex-col rounded-xl"
                  >
                    <span className="text-2xl">{STAMP_EMOJI[site.category]}</span>
                    <span className="text-xs font-semibold text-center px-1 leading-tight mt-1"
                      style={{ color: STAMP_COLORS[site.category], fontSize: "8px" }}>
                      {name(site).split(" ").slice(0, 2).join(" ")}
                    </span>
                  </div>
                )}
                {!isVisited && (
                  <span className="text-xl opacity-30">{STAMP_EMOJI[site.category]}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {visitedCount === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Start exploring to collect stamps!</p>
          <p className="text-xs mt-1">Visit sites on the map or tour list to earn points.</p>
        </div>
      )}
    </div>
  );
}
