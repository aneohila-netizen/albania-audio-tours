/**
 * AppLoadingScreen — branded first-load overlay.
 *
 * Shown only on a user's very first visit (no sessionStorage "alb_onboarded" key)
 * OR when the destinations data hasn't arrived yet.
 * Auto-dismisses as soon as destinations are loaded.
 * Returns null (invisible) for returning users whose data is already cached.
 */

import { useEffect, useState } from "react";
import { useDestinationsLoading } from "@/lib/useApiData";

// Loading messages cycle while data fetches
const MESSAGES = [
  "Loading destinations",
  "Loading maps",
  "Loading tours",
  "Preparing Albania for you",
];

export default function AppLoadingScreen({ onDone }: { onDone: () => void }) {
  const isLoading = useDestinationsLoading();
  const [msgIdx, setMsgIdx] = useState(0);
  const [dots, setDots] = useState(".");
  const [visible, setVisible] = useState(true);

  // Cycle the loading message every 1.8 seconds
  useEffect(() => {
    const t = setInterval(() => {
      setMsgIdx(i => (i + 1) % MESSAGES.length);
    }, 1800);
    return () => clearInterval(t);
  }, []);

  // Animate the dots: . → .. → ...
  useEffect(() => {
    const t = setInterval(() => {
      setDots(d => d.length >= 3 ? "." : d + ".");
    }, 420);
    return () => clearInterval(t);
  }, []);

  // Dismiss as soon as data is ready — minimum 600ms so it doesn't flash
  useEffect(() => {
    if (!isLoading) {
      const t = setTimeout(() => {
        setVisible(false);
        onDone();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isLoading, onDone]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      style={{ transition: "opacity 0.4s ease", opacity: visible ? 1 : 0 }}
      aria-live="polite"
      aria-label="Loading Albania Audio Tours"
    >
      {/* Eagle mascot */}
      <div className="mb-6 relative">
        <img
          src="/mascot/aeti-greeting.webp"
          alt="Aeti the Eagle"
          className="w-28 h-28 object-contain"
          style={{ animation: "mascot-bounce-in 0.5s ease both" }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      {/* Brand name */}
      <h1
        className="text-2xl font-bold mb-1 tracking-tight"
        style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}
      >
        Albania Audio Tours
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Self-guided tours of Albania
      </p>

      {/* Animated loading message */}
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/70 min-h-[24px]">
        {/* Spinner */}
        <svg
          className="animate-spin shrink-0"
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="hsl(var(--primary))" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <span>
          {MESSAGES[msgIdx]}<span style={{ display: "inline-block", width: "1.5ch" }}>{dots}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="mt-6 rounded-full overflow-hidden"
        style={{ width: 160, height: 3, background: "hsl(var(--muted))" }}
      >
        <div
          style={{
            height: "100%",
            background: "hsl(var(--primary))",
            animation: "loading-bar 2s ease-in-out infinite",
            borderRadius: "999px",
          }}
        />
      </div>

      <style>{`
        @keyframes loading-bar {
          0%   { width: 0%;   margin-left: 0; }
          50%  { width: 60%;  margin-left: 20%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
