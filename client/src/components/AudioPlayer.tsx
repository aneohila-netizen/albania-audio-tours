import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2, Loader2 } from "lucide-react";
import { useApp } from "@/App";
import type { TourSite } from "@shared/schema";
import type { Lang } from "@/lib/i18n";

// ── Language code → BCP-47 locale for SpeechSynthesis ─────────────────────
const SPEECH_LANG: Record<Lang, string> = {
  en: "en-US",
  al: "sq-AL",
  gr: "el-GR",
  it: "it-IT",
  es: "es-ES",
  de: "de-DE",
  fr: "fr-FR",
  ar: "ar-SA",
  sl: "sl-SI",
};

// ── Helper: get stored MP3 URL (admin-uploaded override) ──────────────────
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

// ── Estimate speech duration in seconds (avg ~150 words/min) ──────────────
function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(5, Math.round((words / 150) * 60));
}

interface AudioPlayerProps {
  site: TourSite;
  /** The description text currently shown on the page (already in the selected language) */
  text?: string;
  onComplete?: () => void;
}

export default function AudioPlayer({ site, text, onComplete }: AudioPlayerProps) {
  const { t, lang } = useApp();

  // ── State ──────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingSpeech, setUsingSpeech] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);  // seconds elapsed before last pause

  // ── Decide: use stored MP3 or Web Speech API ──────────────────────────
  const storedUrl = getStoredAudioUrl(site, lang as Lang);

  // Reset everything when lang or site changes
  useEffect(() => {
    stopAll();
    setIsPlaying(false);
    setIsLoading(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setCompleted(false);
    setError(null);
    elapsedRef.current = 0;
    // Decide mode
    setUsingSpeech(!storedUrl);
    if (!storedUrl) {
      const estimatedDur = estimateDuration(text || "");
      setDuration(estimatedDur);
    }
  }, [lang, site.id, storedUrl]);

  // ── Stored MP3: set up audio element ─────────────────────────────────
  useEffect(() => {
    if (usingSpeech || !storedUrl) return;

    const audio = new Audio(storedUrl);
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
      // MP3 failed — fall back to speech
      setUsingSpeech(true);
      setError(null);
      const estimatedDur = estimateDuration(text || "");
      setDuration(estimatedDur);
      audioRef.current = null;
    });
    audio.addEventListener("waiting", () => setIsLoading(true));
    audio.addEventListener("canplay", () => setIsLoading(false));

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [storedUrl, usingSpeech]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => stopAll();
  }, []);

  // ── Helper: stop everything ────────────────────────────────────────────
  function stopAll() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) { audioRef.current.pause(); }
  }

  // ── Speech progress timer ─────────────────────────────────────────────
  function startSpeechTimer(totalDuration: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = elapsedRef.current + (Date.now() - startTimeRef.current) / 1000;
      const clamped = Math.min(elapsed, totalDuration);
      setCurrentTime(clamped);
      setProgress(totalDuration > 0 ? (clamped / totalDuration) * 100 : 0);
      if (clamped >= totalDuration) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
    }, 250);
  }

  // ── Toggle play / pause ────────────────────────────────────────────────
  const toggle = useCallback(() => {
    if (completed) return;

    // ── MP3 mode ──
    if (!usingSpeech && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        audioRef.current.play()
          .then(() => { setIsPlaying(true); setIsLoading(false); })
          .catch(() => {
            setIsLoading(false);
            // Fall back to speech
            setUsingSpeech(true);
            const estimatedDur = estimateDuration(text || "");
            setDuration(estimatedDur);
          });
      }
      return;
    }

    // ── Speech mode ──
    if (!text) { setError("No text available to read."); return; }
    if (!("speechSynthesis" in window)) {
      setError("Audio guide not supported in this browser. Try Chrome or Safari.");
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.pause();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      elapsedRef.current = elapsedRef.current + (Date.now() - startTimeRef.current) / 1000;
      setIsPlaying(false);
      return;
    }

    // Resume paused utterance
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      startSpeechTimer(duration);
      setIsPlaying(true);
      return;
    }

    // Fresh start
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG[lang as Lang] || "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Pick best matching voice
    const voices = window.speechSynthesis.getVoices();
    const targetLang = SPEECH_LANG[lang as Lang] || "en-US";
    const langPrefix = targetLang.split("-")[0];
    const match =
      voices.find(v => v.lang === targetLang) ||
      voices.find(v => v.lang.startsWith(langPrefix));
    if (match) utterance.voice = match;

    utteranceRef.current = utterance;
    elapsedRef.current = 0;

    utterance.onstart = () => {
      setIsLoading(false);
      setIsPlaying(true);
      startSpeechTimer(duration);
    };
    utterance.onpause = () => {
      setIsPlaying(false);
    };
    utterance.onresume = () => {
      startSpeechTimer(duration);
      setIsPlaying(true);
    };
    utterance.onend = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setIsPlaying(false);
      setCompleted(true);
      setProgress(100);
      setCurrentTime(duration);
      onComplete?.();
    };
    utterance.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setIsPlaying(false);
      setIsLoading(false);
      setError("Audio guide error. Please try again.");
    };

    setIsLoading(true);
    setError(null);
    window.speechSynthesis.speak(utterance);

    // Chrome bug: speechSynthesis stops after ~15s unless poked
    const chromePoke = setInterval(() => {
      if (!window.speechSynthesis.speaking) { clearInterval(chromePoke); return; }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 14000);
  }, [isPlaying, usingSpeech, text, lang, duration, completed]);

  // ── Restart ────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    stopAll();
    elapsedRef.current = 0;
    setIsPlaying(false);
    setCompleted(false);
    setProgress(0);
    setCurrentTime(0);
    if (!usingSpeech && audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, [usingSpeech]);

  // ── Seek (MP3 only; speech doesn't support seek) ──────────────────────
  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (usingSpeech) return; // can't seek speech
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = pct * audio.duration;
    setProgress(pct * 100);
    setCurrentTime(audio.currentTime);
  }, [usingSpeech]);

  // ── No text and no audio ───────────────────────────────────────────────
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

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid="audio-player">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 size={16} style={{ color: "hsl(var(--primary))" }} />
          <span className="font-semibold text-sm">{t.audioTourTitle}</span>
          {usingSpeech && (
            <span className="text-xs text-muted-foreground opacity-60">({SPEECH_LANG[lang as Lang]?.split("-")[0].toUpperCase()})</span>
          )}
        </div>
        {completed && (
          <span className="text-xs font-medium" style={{ color: "var(--color-gold, #d4af37)" }}>
            ✓ Complete
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Wave animation */}
      <div className={`audio-wave ${!isPlaying ? "paused" : ""}`} aria-hidden="true">
        {[...Array(5)].map((_, i) => <span key={i} />)}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div
          className={`h-2 bg-muted rounded-full overflow-hidden relative ${usingSpeech ? "cursor-default" : "cursor-pointer"}`}
          onClick={seek}
          data-testid="audio-progress-bar"
          role={usingSpeech ? undefined : "slider"}
          aria-label="Audio progress"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: "hsl(var(--primary))",
              transition: isPlaying ? "width 0.25s linear" : "none",
            }}
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
          disabled={!!error}
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
          {isLoading ? "Loading..." : isPlaying ? t.pauseAudio : (completed ? t.resumeAudio : t.resumeAudio)}
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
