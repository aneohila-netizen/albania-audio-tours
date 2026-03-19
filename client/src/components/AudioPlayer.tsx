import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2, Loader2 } from "lucide-react";
import { useApp } from "@/App";
import type { TourSite } from "@shared/schema";
import type { Lang } from "@/lib/i18n";

interface AudioPlayerProps {
  site: TourSite;
  onComplete?: () => void;
}

function getAudioUrl(site: TourSite, lang: Lang): string | null {
  const s = site as any;
  if (lang === "al" && site.audioUrlAl) return site.audioUrlAl;
  if (lang === "gr" && site.audioUrlGr) return site.audioUrlGr;
  if (lang === "it" && s.audioUrlIt) return s.audioUrlIt;
  if (lang === "es" && s.audioUrlEs) return s.audioUrlEs;
  if (lang === "de" && s.audioUrlDe) return s.audioUrlDe;
  if (lang === "fr" && s.audioUrlFr) return s.audioUrlFr;
  if (lang === "ar" && s.audioUrlAr) return s.audioUrlAr;
  if (lang === "sl" && s.audioUrlSl) return s.audioUrlSl;
  // Default: English audio
  return site.audioUrlEn || null;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ site, onComplete }: AudioPlayerProps) {
  const { t, lang } = useApp();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);       // 0–100
  const [currentTime, setCurrentTime] = useState(0); // seconds
  const [duration, setDuration] = useState(0);       // seconds
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioUrl = getAudioUrl(site, lang as Lang);

  // Create / update audio element when URL changes
  useEffect(() => {
    setIsPlaying(false);
    setIsLoading(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setCompleted(false);
    setError(null);

    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCompleted(true);
      setProgress(100);
      onComplete?.();
    };
    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setError("Unable to load audio. Try again later.");
    };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audioRef.current = null;
    };
  }, [audioUrl]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audio.play()
        .then(() => { setIsPlaying(true); setIsLoading(false); })
        .catch(() => { setError("Playback failed. Please try again."); setIsLoading(false); });
    }
  }, [isPlaying]);

  const restart = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCompleted(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = pct * audio.duration;
    setProgress(pct * 100);
    setCurrentTime(audio.currentTime);
  }, []);

  // No audio available
  if (!audioUrl) {
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

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid="audio-player">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 size={16} style={{ color: "hsl(var(--primary))" }} />
          <span className="font-semibold text-sm">{t.audioTourTitle}</span>
        </div>
        {completed && (
          <span className="text-xs font-medium" style={{ color: "var(--color-gold, #d4af37)" }}>
            ✓ Complete
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Wave animation */}
      <div className={`audio-wave ${!isPlaying ? "paused" : ""}`} aria-hidden="true">
        {[...Array(5)].map((_, i) => <span key={i} />)}
      </div>

      {/* Seekable progress bar */}
      <div className="space-y-1">
        <div
          className="h-2 bg-muted rounded-full overflow-hidden cursor-pointer relative"
          onClick={seek}
          data-testid="audio-progress-bar"
          role="slider"
          aria-label="Audio progress"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-none"
            style={{ width: `${progress}%`, background: "hsl(var(--primary))" }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span data-testid="audio-current-time">{formatTime(currentTime)}</span>
          <span data-testid="audio-duration">{duration > 0 ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          data-testid="audio-play-btn"
          onClick={toggle}
          disabled={completed || !!error}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={16} />
          ) : (
            <Play size={16} />
          )}
          {isLoading ? "Loading..." : isPlaying ? t.pauseAudio : t.resumeAudio}
        </button>

        <button
          data-testid="audio-restart-btn"
          onClick={restart}
          className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm border border-border hover:bg-muted transition-colors"
          aria-label="Restart audio"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
