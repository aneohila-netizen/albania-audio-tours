import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2, Loader2 } from "lucide-react";
import { useApp } from "@/App";
import type { TourSite } from "@shared/schema";
import type { Lang } from "@/lib/i18n";
import { RAILWAY_URL } from "@/lib/queryClient";

// ── Stored MP3 helper (admin-uploaded override) ────────────────────────────
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

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// In-session cache: Map<"siteId:lang:textHash", blob URL>
const audioCache = new Map<string, string>();

function textHash(text: string): string {
  // Simple hash for cache keying
  let h = 0;
  for (let i = 0; i < Math.min(text.length, 200); i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

interface AudioPlayerProps {
  site: TourSite;
  /** The description text already shown on this page (translated to current lang) */
  text?: string;
  onComplete?: () => void;
}

export default function AudioPlayer({ site, text, onComplete }: AudioPlayerProps) {
  const { t, lang } = useApp();

  // ── State ─────────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "ready" = audio element loaded and ready; "generating" = fetching from Gemini
  const [audioStatus, setAudioStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");

  // ── Refs ──────────────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null); // owned blob URL (not from cache)

  // The audio source: prefer stored URL, else we'll generate on-demand
  const storedUrl = getStoredAudioUrl(site, lang as Lang);

  // ── Reset when language or site changes ──────────────────────────────────
  useEffect(() => {
    // Tear down old audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setCompleted(false);
    setError(null);
    setAudioStatus("idle");
  }, [lang, site.id]);

  // ── Set up audio element from a URL ──────────────────────────────────────
  const setupAudio = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0);
    });
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCompleted(true);
      setProgress(100);
      onComplete?.();
    });
    audio.addEventListener("error", () => {
      setIsPlaying(false);
      setIsLoading(false);
      setError("Audio failed to load. Please try again.");
      setAudioStatus("error");
    });
    audio.addEventListener("waiting", () => setIsLoading(true));
    audio.addEventListener("canplay", () => { setIsLoading(false); setAudioStatus("ready"); });

    return audio;
  }, [onComplete]);

  // If storedUrl exists and changes, set up audio immediately
  useEffect(() => {
    if (!storedUrl) return;
    const audio = setupAudio(storedUrl);
    setAudioStatus("ready");
    return () => { audio.pause(); audioRef.current = null; };
  }, [storedUrl, setupAudio]);

  // ── Generate audio on-demand via Gemini TTS ───────────────────────────────
  const generateAudio = useCallback(async () => {
    if (!text) { setError("No description text available."); return; }

    const cacheKey = `${site.id}:${lang}:${textHash(text)}`;
    const cached = audioCache.get(cacheKey);

    if (cached) {
      // Already generated this session — reuse blob URL
      const audio = setupAudio(cached);
      setAudioStatus("ready");
      setIsLoading(true);
      audio.play()
        .then(() => { setIsPlaying(true); setIsLoading(false); })
        .catch(() => { setError("Playback failed."); setIsLoading(false); });
      return;
    }

    setAudioStatus("generating");
    setError(null);

    try {
      // POST text + lang → Railway server generates MP3 via Gemini TTS
      const response = await fetch(`${RAILWAY_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Cache for this session
      audioCache.set(cacheKey, blobUrl);
      blobUrlRef.current = blobUrl;

      const audio = setupAudio(blobUrl);
      setAudioStatus("ready");
      setIsLoading(true);
      audio.play()
        .then(() => { setIsPlaying(true); setIsLoading(false); })
        .catch(() => { setError("Playback failed."); setIsLoading(false); });

    } catch (e: any) {
      setAudioStatus("error");
      setError(e.message || "Audio generation failed. Please try again.");
    }
  }, [text, lang, site.id, setupAudio]);

  // ── Play / Pause toggle ───────────────────────────────────────────────────
  const toggle = useCallback(() => {
    if (completed) return;

    const audio = audioRef.current;

    // Audio already loaded — toggle play/pause
    if (audio && audioStatus === "ready") {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        audio.play()
          .then(() => { setIsPlaying(true); setIsLoading(false); })
          .catch(() => { setError("Playback failed."); setIsLoading(false); });
      }
      return;
    }

    // No audio yet — either use stored URL or generate
    if (storedUrl) {
      // Already set up via useEffect above; if not ready yet just play
      if (audio) {
        setIsLoading(true);
        audio.play()
          .then(() => { setIsPlaying(true); setIsLoading(false); })
          .catch(() => setIsLoading(false));
      }
    } else {
      // Generate on-demand
      generateAudio();
    }
  }, [isPlaying, audioStatus, storedUrl, completed, generateAudio]);

  // ── Restart ───────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCompleted(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  // ── Seek ──────────────────────────────────────────────────────────────────
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

  // ── Cleanup blobs on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  // ── Nothing to play ───────────────────────────────────────────────────────
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

  const isGenerating = audioStatus === "generating";
  const buttonDisabled = isGenerating || !!error;
  const showLoadingSpinner = isLoading || isGenerating;

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

      {/* Generating hint */}
      {isGenerating && (
        <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 size={12} className="animate-spin shrink-0" />
          Preparing your audio guide… this takes a few seconds
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <button
            className="ml-2 underline text-xs"
            onClick={() => { setError(null); setAudioStatus("idle"); }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Wave animation */}
      <div className={`audio-wave ${!isPlaying ? "paused" : ""}`} aria-hidden="true">
        {[...Array(5)].map((_, i) => <span key={i} />)}
      </div>

      {/* Progress bar */}
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
          disabled={buttonDisabled}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {showLoadingSpinner ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={16} />
          ) : (
            <Play size={16} />
          )}
          {isGenerating
            ? "Generating…"
            : showLoadingSpinner
            ? "Loading…"
            : isPlaying
            ? t.pauseAudio
            : t.resumeAudio}
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
