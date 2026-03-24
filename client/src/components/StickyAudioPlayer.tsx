/**
 * StickyAudioPlayer — Global floating audio player fixed to the bottom of the screen.
 * Activated via the useAudioPlayer() context hook from any page.
 * Features: Play/Pause, ±15s skip, playback speed (1x/1.25x/1.5x/2x),
 * transcript modal, progress bar, next-stop button.
 */
import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import {
  Play, Pause, SkipBack, SkipForward, X, Volume2,
  Loader2, FileText, ChevronUp, ChevronDown, Gauge,
  ArrowRight,
} from "lucide-react";
import { RAILWAY_URL } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AudioTrack {
  siteId: number;
  siteSlug: string;
  siteName: string;
  lang: string;
  text: string;           // transcript / description text
  storedUrl?: string | null;
  nextStopUrl?: string | null;  // wouter path to next itinerary stop (optional)
  nextStopName?: string | null;
}

interface AudioPlayerContextType {
  loadTrack: (track: AudioTrack) => void;
  clearTrack: () => void;
  isActive: boolean;
  isPlaying: boolean;
  currentTrack: AudioTrack | null;
  listenedSeconds: number; // how many seconds this session has been played
}

const AudioPlayerContext = createContext<AudioPlayerContextType>({
  loadTrack: () => {},
  clearTrack: () => {},
  isActive: false,
  isPlaying: false,
  currentTrack: null,
  listenedSeconds: 0,
});

export const useAudioPlayer = () => useContext(AudioPlayerContext);

// ── Cache ─────────────────────────────────────────────────────────────────────
const blobCache = new Map<string, string>();

function cacheKey(track: AudioTrack) {
  let h = 0;
  const s = `${track.siteId}:${track.lang}:${track.text.slice(0, 200)}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function fmt(s: number) {
  if (!isFinite(s) || isNaN(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const SPEEDS = [1, 1.25, 1.5, 2] as const;

// ── Provider ──────────────────────────────────────────────────────────────────
export function AudioPlayerProvider({ children, onComplete, onNavigate }: {
  children: React.ReactNode;
  onComplete?: (track: AudioTrack, listenedSec: number) => void;
  onNavigate?: (path: string) => void;
}) {
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [collapsed, setCollapsed] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [listenedSeconds, setListenedSeconds] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listenedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track listened time while playing
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        listenedRef.current += 0.5;
        setListenedSeconds(listenedRef.current);
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying]);

  const teardown = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
    setIsGenerating(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setCompleted(false);
    setError(null);
    listenedRef.current = 0;
    setListenedSeconds(0);
  }, []);

  const attachAudio = useCallback((url: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.playbackRate = speed;

    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0);
    });
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCompleted(true);
      setProgress(100);
    });
    audio.addEventListener("error", () => {
      setIsPlaying(false);
      setIsLoading(false);
      setError("Audio failed to load.");
    });
    audio.addEventListener("waiting", () => setIsLoading(true));
    audio.addEventListener("canplay", () => setIsLoading(false));

    setIsLoading(true);
    audio.play()
      .then(() => { setIsPlaying(true); setIsLoading(false); })
      .catch(() => { setIsLoading(false); setError("Playback blocked. Tap Play to start."); });
  }, [speed]);

  // Notify parent when completed
  useEffect(() => {
    if (completed && track) {
      onComplete?.(track, listenedRef.current);
    }
  }, [completed, track]);

  const loadTrack = useCallback(async (newTrack: AudioTrack) => {
    teardown();
    setTrack(newTrack);
    setCollapsed(false);

    // Use stored URL if available
    if (newTrack.storedUrl) {
      attachAudio(newTrack.storedUrl);
      return;
    }

    // Generate via Gemini TTS
    const key = cacheKey(newTrack);
    const cached = blobCache.get(key);
    if (cached) { attachAudio(cached); return; }

    setIsGenerating(true);
    setError(null);
    try {
      const r = await fetch(`${RAILWAY_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newTrack.text, lang: newTrack.lang, siteId: newTrack.siteId }),
      });
      if (!r.ok) throw new Error(`TTS error ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      blobCache.set(key, url);
      setIsGenerating(false);
      attachAudio(url);
    } catch (e: any) {
      setIsGenerating(false);
      setError(e.message || "Audio generation failed.");
    }
  }, [teardown, attachAudio]);

  const clearTrack = useCallback(() => {
    teardown();
    setTrack(null);
  }, [teardown]);

  // Sync speed changes to audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => setError("Playback failed."));
    }
  }, [isPlaying]);

  const skip = useCallback((sec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + sec, audio.duration || 0));
  }, []);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    setProgress(pct * 100);
  }, []);

  const cycleSpeed = useCallback(() => {
    const idx = SPEEDS.indexOf(speed as any);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
  }, [speed]);

  if (!track) {
    return (
      <AudioPlayerContext.Provider value={{ loadTrack, clearTrack, isActive: false, isPlaying, currentTrack: null, listenedSeconds }}>
        {children}
      </AudioPlayerContext.Provider>
    );
  }

  const showSpinner = isLoading || isGenerating;

  return (
    <AudioPlayerContext.Provider value={{ loadTrack, clearTrack, isActive: true, isPlaying, currentTrack: track, listenedSeconds }}>
      {children}

      {/* ── Sticky player ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        role="region"
        aria-label="Audio guide player"
      >
        {/* Progress bar (tap to seek) — always visible at top of player */}
        <div
          className="h-1 bg-muted cursor-pointer relative"
          onClick={seek}
          role="slider"
          aria-label="Audio progress"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full transition-none"
            style={{ width: `${progress}%`, background: "hsl(var(--primary))" }}
          />
        </div>

        {/* Collapse toggle */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <div className="flex items-center gap-2 min-w-0">
            <Volume2 size={14} className="text-primary shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold truncate">{track.siteName}</span>
            {completed && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 shrink-0">
                ✓ Done
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label={collapsed ? "Expand player" : "Collapse player"}
            >
              {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={clearTrack}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Close audio player"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="px-4 pb-3 space-y-2">
            {/* Generating hint */}
            {isGenerating && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={11} className="animate-spin shrink-0" />
                Preparing audio guide…
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-1.5 flex items-center justify-between">
                <span>{error}</span>
                <button
                  className="underline ml-2"
                  onClick={() => { setError(null); if (track) loadTrack(track); }}
                  aria-label="Retry"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Time row */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{fmt(currentTime)}</span>
              <span>{duration > 0 ? fmt(duration / speed) : "--:--"}</span>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between gap-2">
              {/* Skip back */}
              <button
                onClick={() => skip(-15)}
                className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-muted transition-colors min-w-[44px] min-h-[44px] justify-center"
                aria-label="Skip back 15 seconds"
                disabled={showSpinner}
              >
                <SkipBack size={18} />
                <span className="text-[10px] text-muted-foreground">-15s</span>
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                disabled={showSpinner || (completed && !audioRef.current)}
                className="flex items-center justify-center rounded-full transition-colors disabled:opacity-50"
                style={{
                  width: 52, height: 52, minWidth: 52, minHeight: 52,
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
                aria-label={isPlaying ? "Pause audio" : "Play audio"}
              >
                {showSpinner
                  ? <Loader2 size={22} className="animate-spin" />
                  : isPlaying
                  ? <Pause size={22} />
                  : <Play size={22} />}
              </button>

              {/* Skip forward */}
              <button
                onClick={() => skip(15)}
                className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-muted transition-colors min-w-[44px] min-h-[44px] justify-center"
                aria-label="Skip forward 15 seconds"
                disabled={showSpinner}
              >
                <SkipForward size={18} />
                <span className="text-[10px] text-muted-foreground">+15s</span>
              </button>

              {/* Speed */}
              <button
                onClick={cycleSpeed}
                className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-muted transition-colors min-w-[44px] min-h-[44px] justify-center"
                aria-label={`Playback speed ${speed}x. Tap to change.`}
              >
                <Gauge size={16} />
                <span className="text-[10px] font-semibold text-primary">{speed}×</span>
              </button>

              {/* Transcript */}
              <button
                onClick={() => setShowTranscript(true)}
                className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-muted transition-colors min-w-[44px] min-h-[44px] justify-center"
                aria-label="Show transcript"
              >
                <FileText size={16} />
                <span className="text-[10px] text-muted-foreground">Text</span>
              </button>

              {/* Next Stop (optional) */}
              {track.nextStopUrl && (
                <button
                  onClick={() => onNavigate?.(track.nextStopUrl!)}
                  className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-muted transition-colors min-w-[44px] min-h-[44px] justify-center"
                  aria-label={`Next stop: ${track.nextStopName || "Next"}`}
                >
                  <ArrowRight size={16} className="text-primary" />
                  <span className="text-[10px] text-primary font-medium">Next</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Transcript modal ── */}
      {showTranscript && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-end"
          onClick={() => setShowTranscript(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Audio transcript"
        >
          <div
            className="w-full bg-card rounded-t-2xl p-6 max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                Transcript
              </h2>
              <button
                onClick={() => setShowTranscript(false)}
                className="p-2 rounded-lg hover:bg-muted"
                aria-label="Close transcript"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {track.text || "No transcript available."}
            </p>
          </div>
        </div>
      )}
    </AudioPlayerContext.Provider>
  );
}
