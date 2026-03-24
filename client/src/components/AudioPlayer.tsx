/**
 * AudioPlayer — Inline component on detail pages.
 * When Play is pressed, loads the track into the global StickyAudioPlayer
 * which persists at the bottom of the screen across navigation.
 */
import { Volume2, Play, Loader2 } from "lucide-react";
import { useApp } from "@/App";
import type { TourSite } from "@shared/schema";
import type { Lang } from "@/lib/i18n";
import { useAudioPlayer } from "@/components/StickyAudioPlayer";
import type { AudioTrack } from "@/components/StickyAudioPlayer";

// ── Stored MP3 helper ─────────────────────────────────────────────────────────
function getStoredAudioUrl(site: TourSite, lang: Lang): string | null {
  const s = site as any;
  const map: Partial<Record<Lang, string | null>> = {
    en: site.audioUrlEn,
    al: site.audioUrlAl,
    gr: site.audioUrlGr,
    it: s.audioUrlIt,
    es: s.audioUrlEs,
    de: s.audioUrlDe,
    fr: s.audioUrlFr,
    ar: s.audioUrlAr,
    sl: s.audioUrlSl,
  };
  return map[lang] || null;
}

interface AudioPlayerProps {
  site: TourSite;
  text?: string;
  onComplete?: () => void;
  nextStopUrl?: string | null;
  nextStopName?: string | null;
}

export default function AudioPlayer({ site, text, onComplete, nextStopUrl, nextStopName }: AudioPlayerProps) {
  const { t, lang } = useApp();
  const { loadTrack, isActive, currentTrack, isPlaying } = useAudioPlayer();

  const storedUrl = getStoredAudioUrl(site, lang as Lang);

  // Is this specific site currently playing in the sticky player?
  const isThisSitePlaying = isActive && currentTrack?.siteId === site.id && currentTrack?.lang === lang;

  if (!text && !storedUrl) {
    return (
      <div
        className="rounded-xl border border-dashed border-border p-4 text-center"
        style={{ fontSize: "var(--text-sm)", color: "hsl(var(--muted-foreground))" }}
      >
        <Volume2 size={20} className="mx-auto mb-2 opacity-40" />
        <p>{t.noAudio}</p>
      </div>
    );
  }

  const handlePlay = () => {
    const track: AudioTrack = {
      siteId: site.id,
      siteSlug: site.slug,
      siteName: (site as any)[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`] || site.nameEn,
      lang,
      text: text || "",
      storedUrl: storedUrl || null,
      nextStopUrl: nextStopUrl || null,
      nextStopName: nextStopName || null,
    };
    loadTrack(track);
    onComplete; // onComplete is now handled via AudioPlayerProvider's onComplete callback
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4" data-testid="audio-player">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Volume2 size={16} style={{ color: "hsl(var(--primary))" }} />
          <span className="font-semibold text-sm">{t.audioTourTitle}</span>
        </div>
        {isThisSitePlaying && (
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: "hsl(var(--primary))" }}>
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {isPlaying ? "Playing" : "Paused"}
          </span>
        )}
      </div>

      {isThisSitePlaying ? (
        <p className="text-xs text-muted-foreground text-center py-1">
          ↓ Audio playing in the guide bar below
        </p>
      ) : (
        <button
          onClick={handlePlay}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-medium text-sm transition-colors"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          aria-label={`Play audio guide for ${site.nameEn}`}
        >
          <Play size={16} />
          {t.resumeAudio}
        </button>
      )}
    </div>
  );
}
