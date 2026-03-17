import { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2 } from "lucide-react";
import { useApp } from "@/App";
import type { TourSite } from "@shared/schema";
import type { Lang } from "@/lib/i18n";

interface AudioPlayerProps {
  site: TourSite;
  onComplete?: () => void;
}

// Simulated audio narration as TTS-style text segments
// In production these would be actual audio files
const NARRATION_TEXTS: Record<string, Partial<Record<Lang, string[]>>> = {
  butrint: {
    en: [
      "Welcome to Butrint National Park, a UNESCO World Heritage Site.",
      "Founded as a Greek colony around 800 BC, this ancient city witnessed centuries of civilization.",
      "Before you stands the magnificent amphitheatre, carved from solid rock.",
      "The baptistery ahead contains extraordinary 6th-century floor mosaics.",
      "Look to your left for the Venetian Tower, built to guard this strategic lagoon.",
    ],
    al: [
      "Mirë se erdhët në Parkun Kombëtar të Butrintit, Vend i Trashëgimisë Botërore UNESCO.",
      "I themeluar si kolonizim grek rreth 800 para Krishtit, ky qytet antik dëshmoi shekuj të qytetërimit.",
      "Para jush qëndron amfiteatri madhështor, i gdhendur nga guri i fortë.",
    ],
  },
  gjirokaster: {
    en: [
      "Welcome to Gjirokastër Castle — the crown of the City of Stone.",
      "This massive fortress has loomed over the valley for over 2,500 years.",
      "Here you'll find the extraordinary military museum with its captured Cold War aircraft.",
      "The views from these battlements stretch to Greece on clear days.",
    ],
  },
};

export default function AudioPlayer({ site, onComplete }: AudioPlayerProps) {
  const { t, lang } = useApp();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);

  const narration = NARRATION_TEXTS[site.slug]?.[lang] ||
    NARRATION_TEXTS[site.slug]?.["en"] || [];
  const totalSegments = narration.length || 5;
  const currentText = narration[segmentIndex] || narration[0];

  // Simulate audio playback with progress
  useEffect(() => {
    if (isPlaying && !completed) {
      intervalRef.current = setInterval(() => {
        progressRef.current += 1;
        const p = Math.min(progressRef.current, 100);
        setProgress(p);

        // Move to next segment
        const newSegment = Math.floor((p / 100) * totalSegments);
        setSegmentIndex(Math.min(newSegment, totalSegments - 1));

        if (p >= 100) {
          setIsPlaying(false);
          setCompleted(true);
          onComplete?.();
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, 300); // 30 seconds total simulated playback
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, completed, totalSegments, onComplete]);

  const toggle = () => setIsPlaying(p => !p);

  const restart = () => {
    setIsPlaying(false);
    setCompleted(false);
    setProgress(0);
    setSegmentIndex(0);
    progressRef.current = 0;
  };

  const formatTime = (pct: number) => {
    const total = 30; // seconds simulated
    const elapsed = Math.floor((pct / 100) * total);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (narration.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-center" style={{ fontSize: "var(--text-sm)", color: "hsl(var(--muted-foreground))" }}>
        <Volume2 size={20} className="mx-auto mb-2 opacity-40" />
        <p>{t.noAudio}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid="audio-player">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{t.audioTourTitle}</span>
        {completed && (
          <span className="text-xs font-medium" style={{ color: "var(--color-gold)" }}>
            ✓ Complete
          </span>
        )}
      </div>

      {/* Current narration text */}
      <div className="rounded-lg bg-muted p-3 min-h-[60px] text-sm leading-relaxed text-muted-foreground" data-testid="narration-text">
        {currentText || "Ready to start..."}
      </div>

      {/* Wave animation */}
      <div className={`audio-wave ${!isPlaying ? "paused" : ""}`} aria-hidden="true">
        {[...Array(5)].map((_, i) => <span key={i} />)}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "hsl(var(--primary))" }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(progress)}</span>
          <span>{segmentIndex + 1} / {totalSegments}</span>
          <span>0:30</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          data-testid="audio-play-btn"
          onClick={toggle}
          disabled={completed}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          {isPlaying ? t.pauseAudio : t.resumeAudio}
        </button>

        <button
          data-testid="audio-restart-btn"
          onClick={restart}
          className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm border border-border hover:bg-muted transition-colors"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
