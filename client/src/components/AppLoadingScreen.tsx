/**
 * AppLoadingScreen — branded landing loader with Aeti the Eagle.
 *
 *  - Aeti sits on top of the "Loading maps / destinations / tours…" status block.
 *  - First-ever visit: Aeti gives three short orientation tips while the data loads.
 *    The "Skip" button appears the moment the data is ready; if the visitor does nothing the
 *    loader closes by itself once the tips have finished.
 *  - Returning visitors (localStorage flag): no tips — the loader only covers the real loading
 *    time, then hands over straight away.
 *  - When it closes, MapPage opens the red "Explore Nearby" widget directly (no guide slides;
 *    the full guide lives behind the "?" help button).
 *
 * The first paint comes from the static shell in index.html; this component matches its layout
 * so the hand-over from HTML shell to React is seamless.
 */

import { useEffect, useRef, useState } from "react";
import { useDestinationsLoading } from "@/lib/useApiData";

const MESSAGES = [
  "Loading maps",
  "Loading destinations",
  "Loading tours",
  "Preparing Albania for you",
];

const TIPS = [
  { img: "/mascot/aeti-greeting.webp", text: "Hi, I'm Aeti! Tap any pin on the map to hear its story." },
  { img: "/mascot/aeti-tap.webp",      text: "Open Destinations to browse every place and pick your tour." },
  { img: "/mascot/aeti-celebrate.webp", text: "Share your location and I'll find the tour closest to you." },
];
const TIP_MS = 2200;
const INTRO_KEY = "alb_intro_seen";

function introSeenBefore(): boolean {
  try { return localStorage.getItem(INTRO_KEY) === "1"; } catch { return false; }
}

export default function AppLoadingScreen({ onDone }: { onDone: () => void }) {
  const isLoading = useDestinationsLoading();
  const dataReady = !isLoading;
  const showTips = useRef(!introSeenBefore()).current;

  const [msgIdx, setMsgIdx] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [tipsDone, setTipsDone] = useState(!showTips);
  const [leaving, setLeaving] = useState(false);
  const finished = useRef(false);

  // Rotate the status message
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 1800);
    return () => clearInterval(t);
  }, []);

  // Aeti's tips: advance every TIP_MS, mark done after the last one has been shown
  useEffect(() => {
    if (!showTips) return;
    const t = setInterval(() => {
      setTipIdx(i => {
        if (i >= TIPS.length - 1) { setTipsDone(true); return i; }
        return i + 1;
      });
    }, TIP_MS);
    return () => clearInterval(t);
  }, [showTips]);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    try { localStorage.setItem(INTRO_KEY, "1"); } catch {}
    setLeaving(true);
    setTimeout(onDone, 220); // let the fade-out play
  }

  // Close automatically: data ready AND (tips finished OR returning visitor). Tiny minimum so it never flashes.
  useEffect(() => {
    if (!dataReady || !tipsDone) return;
    const t = setTimeout(finish, showTips ? 400 : 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, tipsDone]);

  const tip = TIPS[tipIdx];

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-6"
      style={{ transition: "opacity 0.22s ease", opacity: leaving ? 0 : 1 }}
      role="status"
      aria-live="polite"
      aria-label="Loading Albania Audio Tours"
    >
      {/* Aeti — on top of the loading information */}
      <img
        key={tip.img}
        src={tip.img}
        alt="Aeti the Eagle"
        width={120}
        height={120}
        className="w-[120px] h-[120px] object-contain mb-3 aat-aeti"
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />

      {/* Speech bubble with the current tip (first visit only) */}
      <div className="h-[64px] mb-4 flex items-start justify-center">
        {showTips && (
          <p
            key={tipIdx}
            className="aat-bubble relative max-w-[300px] text-center text-sm font-medium text-foreground rounded-2xl border border-border bg-card px-4 py-2.5 shadow-sm"
          >
            {tip.text}
          </p>
        )}
      </div>

      <h1
        className="text-2xl font-bold mb-1 tracking-tight text-center"
        style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}
      >
        Albania Audio Tours
      </h1>
      <p className="text-sm text-muted-foreground mb-6">Self-guided tours of Albania</p>

      {/* Dynamic loading information */}
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/70 min-h-[24px]">
        <svg
          className="animate-spin shrink-0"
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <span>
          {dataReady ? "Ready" : MESSAGES[msgIdx]}
          {!dataReady && <span className="aat-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>}
        </span>
      </div>

      <div className="mt-5 rounded-full overflow-hidden" style={{ width: 160, height: 3, background: "hsl(var(--muted))" }}>
        <div
          style={{
            height: "100%",
            background: "hsl(var(--primary))",
            borderRadius: 999,
            ...(dataReady ? { width: "100%" } : { animation: "aat-bar 2s ease-in-out infinite" }),
          }}
        />
      </div>

      {/* Skip — appears the moment the data is ready */}
      <div className="h-[44px] mt-6 flex items-center justify-center">
        {dataReady && (
          <button
            type="button"
            onClick={finish}
            className="aat-skip px-5 py-2 rounded-full text-sm font-semibold border border-border bg-card hover:bg-muted transition-colors"
          >
            Skip
          </button>
        )}
      </div>

      <style>{`
        .aat-aeti { animation: aat-bob 2.2s ease-in-out infinite; }
        .aat-bubble { animation: aat-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
        .aat-skip { animation: aat-fade 0.3s ease both; }
        .aat-dots i { font-style: normal; animation: aat-dot 1.2s infinite both; }
        .aat-dots i:nth-child(2) { animation-delay: 0.2s; }
        .aat-dots i:nth-child(3) { animation-delay: 0.4s; }
        @keyframes aat-bob   { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-8px) rotate(1deg); } }
        @keyframes aat-pop   { from { opacity: 0; transform: translateY(6px) scale(0.96); } to { opacity: 1; transform: none; } }
        @keyframes aat-fade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes aat-dot   { 0%,80%,100% { opacity: 0.2; } 40% { opacity: 1; } }
        @keyframes aat-bar   { 0% { width: 0%; margin-left: 0; } 50% { width: 60%; margin-left: 20%; } 100% { width: 0%; margin-left: 100%; } }
        @media (prefers-reduced-motion: reduce) {
          .aat-aeti, .aat-bubble, .aat-skip { animation: none; }
          .aat-dots i { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
