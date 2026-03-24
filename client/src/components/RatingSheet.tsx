/**
 * RatingSheet — 5-star rating bottom sheet.
 * Triggered after audio completion or on exit (≥30s listened).
 * Confirmation state: keeps dark overlay, shows checkmark + star count + smooth fade.
 * POSTs rating to /api/ratings for persistence.
 */
import { useState } from "react";
import { Star, X, CheckCircle2 } from "lucide-react";
import { RAILWAY_URL } from "@/lib/queryClient";

const RATED_SITES = new Set<number>(); // session-level: don't ask twice

interface RatingSheetProps {
  siteId: number;
  siteSlug: string;
  siteName: string;
  trigger: "completion" | "exit";
  listenedSeconds: number;
  onClose: () => void;
}

export default function RatingSheet({
  siteId, siteSlug, siteName, trigger, listenedSeconds, onClose,
}: RatingSheetProps) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [fading, setFading] = useState(false);

  // Exit-intent: only show if user listened ≥30 seconds
  if (trigger === "exit" && listenedSeconds < 30) return null;
  // Don't show if already rated this site this session
  if (RATED_SITES.has(siteId)) return null;

  const handleRate = async (star: number) => {
    setSelected(star);
    RATED_SITES.add(siteId);
    setSubmitted(true);

    // POST to backend (fire-and-forget — don't block UX on network)
    try {
      await fetch(`${RAILWAY_URL}/api/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, siteSlug, stars: star }),
      });
    } catch { /* silent — rating still visually confirmed */ }

    // Wait 2.5s then fade out over 400ms
    setTimeout(() => {
      setFading(true);
      setTimeout(onClose, 400);
    }, 2500);
  };

  const handleDismiss = () => {
    RATED_SITES.add(siteId);
    onClose();
  };

  const headings = {
    completion: "How was your audio tour?",
    exit: "Enjoying the tour?",
  };
  const subtexts = {
    completion: `Rate your experience at ${siteName}`,
    exit: "Give us a quick rating before you go",
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end transition-opacity duration-400"
      style={{
        background: "rgba(0,0,0,0.45)",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
      }}
      onClick={submitted ? undefined : handleDismiss}
    >
      <div
        className="w-full bg-card rounded-t-2xl px-6 pt-5 shadow-2xl"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
        onClick={e => e.stopPropagation()}
      >
        {submitted ? (
          /* ── Confirmation state ── */
          <div className="text-center py-6 space-y-3">
            <CheckCircle2
              size={52}
              className="mx-auto"
              style={{ color: "#22c55e" }}
              aria-hidden="true"
            />
            <div>
              <p className="font-bold text-lg">Thank you!</p>
              <p className="text-sm text-muted-foreground mt-1">
                You rated{" "}
                <span className="font-semibold text-foreground">
                  {selected} star{selected !== 1 ? "s" : ""}
                </span>{" "}
                for {siteName}
              </p>
            </div>
            {/* Re-render the selected stars so user sees what they chose */}
            <div className="flex justify-center gap-2 pt-1">
              {[1, 2, 3, 4, 5].map(s => (
                <Star
                  key={s}
                  size={24}
                  fill={s <= selected ? "#F59E0B" : "none"}
                  stroke={s <= selected ? "#F59E0B" : "hsl(var(--muted-foreground))"}
                  strokeWidth={1.5}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              Your feedback helps improve the tour experience
            </p>
          </div>
        ) : (
          /* ── Rating input state ── */
          <>
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="font-semibold text-base">{headings[trigger]}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{subtexts[trigger]}</p>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg hover:bg-muted -mt-1 -mr-1"
                aria-label="Dismiss rating"
              >
                <X size={16} />
              </button>
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-3 mt-5 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => handleRate(star)}
                  className="transition-transform active:scale-90"
                  style={{
                    minWidth: 44, minHeight: 44,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                >
                  <Star
                    size={36}
                    fill={(hovered || selected) >= star ? "#F59E0B" : "none"}
                    stroke={(hovered || selected) >= star ? "#F59E0B" : "hsl(var(--muted-foreground))"}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground pb-2">
              Tap a star to rate · Your feedback helps improve the tour
            </p>
          </>
        )}
      </div>
    </div>
  );
}
