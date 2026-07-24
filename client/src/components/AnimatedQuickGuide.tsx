import { useEffect, useMemo, useRef, useState } from "react";
import { X, Play, Pause, Locate, Headphones } from "lucide-react";
import type { Translations } from "@/lib/i18n";

/**
 * Animated Quick Guide — "Aeti the Eagle" mascot walkthrough.
 *
 * Replaces the static step-by-step Quick Guide with a short (~18s),
 * auto-advancing, skippable animated tour. Each scene keeps the real
 * functional action button from the app (Share Location, category
 * filters, Destinations toggle, Start Tour) so it's still a working
 * walkthrough, not just a passive video.
 *
 * Respects `prefers-reduced-motion` at the call site — MapPage decides
 * whether to render this component or the legacy static guide.
 */

interface Scene {
  mascot: string;
  animClass: string;
  /** ms this scene stays on screen before auto-advancing. null = stays until closed (final scene). */
  duration: number | null;
  caption: string;
  isIntro?: boolean;
  visual?: React.ReactNode;
}

interface AnimatedQuickGuideProps {
  t: Translations;
  onClose: () => void;
  onShareLocation: () => void;
  onFilterCategory: (val: string) => void;
  onBrowseDestinations: () => void;
  onStartTour: () => void;
}

const MASCOT = {
  greeting: "/mascot/aeti-greeting.webp",
  tap: "/mascot/aeti-tap.webp",
  celebrate: "/mascot/aeti-celebrate.webp",
};

export default function AnimatedQuickGuide({
  t,
  onClose,
  onShareLocation,
  onFilterCategory,
  onBrowseDestinations,
  onStartTour,
}: AnimatedQuickGuideProps) {
  const SCENES: Scene[] = useMemo(
    () => [
      {
        mascot: MASCOT.greeting,
        animClass: "mascot-bounce-in",
        duration: 3000,
        caption: t.guideAnimS0,
        isIntro: true,
      },
      {
        mascot: MASCOT.tap,
        animClass: "mascot-tap-pulse",
        duration: 4000,
        caption: t.guideAnimS1,
        visual: (
          <button
            onClick={onShareLocation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-card hover:bg-muted transition-colors"
          >
            <Locate size={12} className="text-primary" />
            Share Location
          </button>
        ),
      },
      {
        mascot: MASCOT.tap,
        animClass: "mascot-tap-pulse",
        duration: 4000,
        caption: t.guideAnimS2,
        visual: (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {[
              { label: "🏖️ Beach", val: "Beach" },
              { label: "🏰 Castle", val: "Castle" },
            ].map(({ label, val }) => (
              <button
                key={val}
                onClick={() => onFilterCategory(val)}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-border bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        ),
      },
      {
        mascot: MASCOT.tap,
        animClass: "mascot-tap-pulse",
        duration: 3000,
        caption: t.guideAnimS3,
        visual: (
          <button
            onClick={onBrowseDestinations}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            🗺️ Browse Destinations
          </button>
        ),
      },
      {
        mascot: MASCOT.tap,
        animClass: "mascot-tap-pulse",
        duration: 3000,
        caption: t.guideAnimS4,
        visual: (
          <button
            onClick={onStartTour}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            <Headphones size={12} />
            Start Tirana Tour
          </button>
        ),
      },
      {
        mascot: MASCOT.celebrate,
        animClass: "mascot-celebrate-pulse",
        duration: null,
        caption: t.guideAnimS5,
      },
    ],
    [t, onShareLocation, onFilterCategory, onBrowseDestinations, onStartTour]
  );

  const [sceneIndex, setSceneIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);
  const remainingRef = useRef<number | null>(null);
  const sceneStartRef = useRef<number>(Date.now());
  const scene = SCENES[sceneIndex];
  const isLast = sceneIndex === SCENES.length - 1;

  // Drives auto-advance. Re-runs on scene change or pause toggle.
  useEffect(() => {
    if (isPaused || scene.duration == null) return;
    const remaining = remainingRef.current ?? scene.duration;
    sceneStartRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      remainingRef.current = null;
      setSceneIndex((i) => Math.min(i + 1, SCENES.length - 1));
    }, remaining);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneIndex, isPaused]);

  function togglePause() {
    setIsPaused((prev) => {
      const next = !prev;
      if (next && scene.duration != null) {
        const elapsed = Date.now() - sceneStartRef.current;
        remainingRef.current = Math.max(0, scene.duration - elapsed);
        if (timerRef.current) window.clearTimeout(timerRef.current);
      }
      return next;
    });
  }

  function jumpTo(i: number) {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    remainingRef.current = null;
    setSceneIndex(i);
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center px-5"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
      role="dialog"
      aria-live="polite"
      aria-label={t.guideGreeting}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
        style={{ animation: "popup-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar — tappable dots, one per scene */}
        <div className="flex gap-0.5 px-1.5 pt-1.5">
          {SCENES.map((_, i) => (
            <button
              key={i}
              onClick={() => jumpTo(i)}
              aria-label={`Step ${i + 1} of ${SCENES.length}`}
              className="flex-1 h-1 rounded-full overflow-hidden bg-muted relative"
            >
              {i < sceneIndex && <div className="absolute inset-0" style={{ background: "hsl(var(--primary))" }} />}
              {i === sceneIndex && (
                <div
                  key={`bar-${sceneIndex}`}
                  className="absolute inset-0 origin-left"
                  style={{
                    background: "hsl(var(--primary))",
                    transform: scene.duration == null ? "scaleX(1)" : undefined,
                    animation: scene.duration != null ? `guide-progress-fill ${scene.duration}ms linear forwards` : undefined,
                    animationPlayState: isPaused ? "paused" : "running",
                  }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Header controls — Pause/Play + X, always available */}
        <div className="flex items-center justify-end gap-1 px-2 pt-1">
          {scene.duration != null && (
            <button
              onClick={togglePause}
              aria-label={isPaused ? t.guidePlayLabel : t.guidePauseLabel}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              {isPaused ? <Play size={13} /> : <Pause size={13} />}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label={t.guideSkip}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 pt-1 pb-5 space-y-3 text-center">
          {scene.isIntro && (
            <p className="text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {t.guideGreeting}
            </p>
          )}

          <div className="relative flex items-center justify-center" style={{ height: 108 }}>
            <img
              key={`mascot-${sceneIndex}`}
              src={scene.mascot}
              alt=""
              aria-hidden="true"
              className={scene.animClass}
              style={{ height: 100, animationPlayState: isPaused ? "paused" : "running" }}
            />
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed px-1">{scene.caption}</p>

          {scene.visual && <div className="pt-0.5 flex justify-center">{scene.visual}</div>}

          {isLast ? (
            <button
              onClick={onClose}
              className="w-full mt-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              Start Exploring
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              {t.guideSkip}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
