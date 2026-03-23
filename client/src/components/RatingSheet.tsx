/**
 * RatingSheet — Non-intrusive 5-star rating bottom sheet.
 * Shown after audio completes (any listen time) or on exit if ≥30s listened.
 * Once rated or dismissed, won't show again for the same site in this session.
 */
import { useState } from "react";
import { Star, X } from "lucide-react";

const RATED_SITES = new Set<number>(); // session-level memory

interface RatingSheetProps {
  siteId: number;
  siteName: string;
  trigger: "completion" | "exit"; // completion = always show; exit = only if >=30s
  listenedSeconds: number;
  onClose: () => void;
}

export default function RatingSheet({ siteId, siteName, trigger, listenedSeconds, onClose }: RatingSheetProps) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  // Exit-intent: only show if user listened ≥30 seconds
  if (trigger === "exit" && listenedSeconds < 30) return null;
  // Don't show if already rated this site this session
  if (RATED_SITES.has(siteId)) return null;

  const handleRate = (star: number) => {
    setSelected(star);
    RATED_SITES.add(siteId);
    setSubmitted(true);
    // Could POST to /api/ratings in the future
    setTimeout(onClose, 1400);
  };

  const handleDismiss = () => {
    RATED_SITES.add(siteId); // don't ask again this session
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
      className="fixed inset-0 z-[55] flex items-end"
      style={{ background: submitted ? "transparent" : "rgba(0,0,0,0.35)" }}
      onClick={submitted ? undefined : handleDismiss}
    >
      <div
        className="w-full bg-card rounded-t-2xl px-6 pt-5 pb-8 shadow-2xl"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
        onClick={e => e.stopPropagation()}
      >
        {submitted ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-1">🙏</p>
            <p className="font-semibold text-sm">Thank you for your feedback!</p>
          </div>
        ) : (
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
                  style={{ minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
                  aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                >
                  <Star
                    size={34}
                    fill={(hovered || selected) >= star ? "#F59E0B" : "none"}
                    stroke={(hovered || selected) >= star ? "#F59E0B" : "hsl(var(--muted-foreground))"}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Tap a star to rate · Your feedback helps improve the tour
            </p>
          </>
        )}
      </div>
    </div>
  );
}
