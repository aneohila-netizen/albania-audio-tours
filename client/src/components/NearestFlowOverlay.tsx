/**
 * NearestFlowOverlay — "Show Me What's Nearby" flow.
 *
 *  1. Ask the device for its location (browser shows the permission prompt if needed)
 *  2. Find the nearest destination among ALL destinations that have coordinates
 *  3. If the device is farther than FAR_THRESHOLD_M from every destination, ask first
 *  4. Show "loading maps, hotels, restaurants, things to do…", warm the destination
 *     data, then open /sites/<slug> with Explore Nearby expanded + scrolled (one-shot intent)
 *
 * Every stage has a Cancel link. A denied/unavailable location offers retry,
 * "choose a destination instead", and a Google Maps fallback.
 */
import { useEffect, useRef, useState } from "react";
import { Check, MapPin, X } from "lucide-react";
import { prefetchDestination } from "@/lib/useApiData";
import { getNearby } from "@/lib/nearbyCache";
import { getGlobalPaywallActive } from "@/components/PaywallGate";
import {
  FAR_THRESHOLD_M,
  findNearestDestination,
  formatKm,
  saveUserPosition,
  setNearbyIntent,
  type LatLng,
} from "@/lib/nearestDestination";

interface Dest { slug: string; lat: number; lng: number }

type Stage = "locating" | "finding" | "far" | "loading" | "error";
type ErrKind = "permission_denied" | "position_unavailable" | "timeout" | "unsupported" | "no_destinations";

const STEPS = [
  "Finding your location",
  "Finding the nearest destination",
  "Loading maps, hotels, restaurants and things to do",
];

const MIN_STEP_MS = 700;      // each message stays readable even on a fast connection
const MAX_PREFETCH_MS = 4000; // never hold the user longer than this on slow networks

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export default function NearestFlowOverlay({
  destinations,
  destName,
  onNavigate,
  onCancel,
  onChooseDestination,
}: {
  destinations: Dest[];
  destName: (slug: string) => string;
  onNavigate: (path: string) => void;
  onCancel: () => void;
  onChooseDestination: () => void;
}) {
  const [stage, setStage] = useState<Stage>("locating");
  const [errKind, setErrKind] = useState<ErrKind>("position_unavailable");
  const [pos, setPos] = useState<LatLng | null>(null);
  const [nearest, setNearest] = useState<{ slug: string; distM: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cancelled = useRef(false);
  const started = useRef(false); // guards against navigating twice

  useEffect(() => {
    cancelled.current = false;
    return () => { cancelled.current = true; };
  }, []);

  // Step 1 — device location
  useEffect(() => {
    setStage("locating");
    setPos(null);
    setNearest(null);
    started.current = false;
    if (!("geolocation" in navigator)) {
      setErrKind("unsupported");
      setStage("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      p => {
        if (cancelled.current) return;
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        saveUserPosition(here);
        setPos(here);
      },
      err => {
        if (cancelled.current) return;
        setErrKind(
          err.code === 1 ? "permission_denied" : err.code === 3 ? "timeout" : "position_unavailable",
        );
        setStage("error");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 },
    );
  }, [attempt]);

  // Step 2 — nearest destination (waits for the destination list if it is not ready yet)
  useEffect(() => {
    if (!pos) return;
    setStage("finding");
    if (destinations.length === 0) return; // re-runs when the list arrives
    let alive = true;
    (async () => {
      await sleep(MIN_STEP_MS);
      if (!alive || cancelled.current) return;
      const best = findNearestDestination(destinations, pos);
      if (!best) { setErrKind("no_destinations"); setStage("error"); return; }
      const found = { slug: best.dest.slug, distM: best.distM };
      setNearest(found);
      if (found.distM > FAR_THRESHOLD_M) { setStage("far"); return; }
      proceed(found.slug);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, destinations.length]);

  // Step 3 — warm the destination data, then navigate
  async function proceed(slug: string) {
    if (started.current) return;
    started.current = true;
    setStage("loading");
    const d = destinations.find(x => x.slug === slug);
    // Warm the default Explore Nearby tab (hotels) only when the feature is free for
    // everyone; with the paywall on we skip it so non-subscribers never trigger Places calls.
    const warmNearby = async () => {
      try {
        if (d && (await getGlobalPaywallActive()) === false) await getNearby(d.lat, d.lng, "lodging");
      } catch {}
    };
    await Promise.race([
      Promise.all([prefetchDestination(slug), warmNearby(), sleep(MIN_STEP_MS * 1.5)]),
      sleep(MAX_PREFETCH_MS),
    ]);
    if (cancelled.current) return;
    setNearbyIntent(slug); // destination page opens Explore Nearby once, then clears this
    onNavigate(`/sites/${slug}`);
  }

  const stepIndex = stage === "locating" ? 0 : stage === "finding" || stage === "far" ? 1 : 2;

  const errorText: Record<ErrKind, { title: string; body: string }> = {
    permission_denied: {
      title: "Location is blocked",
      body: "Allow location for this site in your browser settings (tap the lock icon next to the address), then try again.",
    },
    position_unavailable: {
      title: "Could not find your location",
      body: "Your device could not determine its position. Check that location services are on and try again.",
    },
    timeout: {
      title: "Location is taking too long",
      body: "We could not get a location fix in time. Try again, or choose a destination yourself.",
    },
    unsupported: {
      title: "Location is not supported",
      body: "This browser cannot share a location. You can choose a destination yourself.",
    },
    no_destinations: {
      title: "No destinations available",
      body: "Destinations are not loaded yet. Please try again in a moment.",
    },
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-background px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Finding what is near you"
    >
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-4 right-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <X size={16} /> Cancel
      </button>

      <div className="w-full max-w-sm">
        <div
          className="mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "hsl(var(--primary)/0.1)" }}
        >
          <MapPin size={26} className="text-primary" />
        </div>

        {stage === "error" && (
          <div className="text-center">
            <h2 className="font-bold text-lg mb-2" style={{ fontFamily: "var(--font-display)" }}>
              {errorText[errKind].title}
            </h2>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{errorText[errKind].body}</p>
            <div className="flex flex-col gap-2">
              {errKind !== "unsupported" && errKind !== "no_destinations" && (
                <button
                  type="button"
                  onClick={() => setAttempt(a => a + 1)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                >
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={onChooseDestination}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-muted/50"
              >
                Choose a destination instead
              </button>
              {errKind === "permission_denied" && (
                <a
                  href="https://www.google.com/maps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Use Google Maps instead
                </a>
              )}
            </div>
          </div>
        )}

        {stage === "far" && nearest && (
          <div className="text-center">
            <h2 className="font-bold text-lg mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Nearest destination: {destName(nearest.slug)}
            </h2>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              {formatKm(nearest.distM)} away from your current location. You can still explore hotels,
              restaurants and things to do there.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => proceed(nearest.slug)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                Continue
              </button>
              <button
                type="button"
                onClick={onChooseDestination}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-muted/50"
              >
                Choose another destination
              </button>
            </div>
          </div>
        )}

        {(stage === "locating" || stage === "finding" || stage === "loading") && (
          <div>
            <h2
              className="font-bold text-lg mb-5 text-center"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Finding what is near you
            </h2>
            <ul className="space-y-3" aria-live="polite">
              {STEPS.map((label, i) => {
                const done = i < stepIndex;
                const current = i === stepIndex;
                return (
                  <li key={label} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center">
                      {done ? (
                        <Check size={16} className="text-primary" />
                      ) : current ? (
                        <svg
                          className="animate-spin"
                          width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                      )}
                    </span>
                    <span
                      className={
                        done ? "text-muted-foreground" : current ? "font-medium text-foreground" : "text-muted-foreground/50"
                      }
                    >
                      {label}
                      {current && (
                        <span className="nf-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {stage === "locating" && (
              <p className="mt-5 text-xs text-muted-foreground text-center">
                If your browser asks, choose Allow to share your location.
              </p>
            )}
          </div>
        )}
      </div>

      <style>{`
        .nf-dots i { font-style: normal; animation: nf-dot 1.2s infinite both; }
        .nf-dots i:nth-child(2) { animation-delay: 0.2s; }
        .nf-dots i:nth-child(3) { animation-delay: 0.4s; }
        @keyframes nf-dot { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .nf-dots i { animation: none; opacity: 1; } }
      `}</style>
    </div>
  );
}
