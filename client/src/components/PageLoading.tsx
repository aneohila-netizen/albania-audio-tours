/**
 * PageLoading — shared "Loading…" transition message for every page change.
 *
 *  - <PageLoading label="Loading destination" />        full-screen (route fallback)
 *  - <PageLoading label="Loading destination" inline /> compact, sits above skeletons
 *  - <RouteLoadingFallback />                           Suspense fallback; picks the
 *                                                       label from the current route
 *
 * The message only appears after `delayMs` so fast navigations never flicker.
 * Animated dots are CSS-only and are static when the user prefers reduced motion.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

function routeLabel(path: string): string {
  const p = (path || "/").split("?")[0].replace(/\/+$/, "") || "/";
  if (p === "/") return "Loading map";
  if (p === "/sites") return "Loading destinations";
  if (/^\/sites\/[^/]+\/[^/]+$/.test(p)) return "Loading attraction";
  if (/^\/sites\/[^/]+$/.test(p)) return "Loading destination";
  if (p === "/passport") return "Loading your passport";
  if (p === "/leaderboard") return "Loading leaderboard";
  if (p === "/blog") return "Loading blog";
  if (p === "/guides") return "Loading guides";
  if (p === "/subscriptions") return "Loading plans";
  if (p === "/contact") return "Loading contact page";
  if (p.startsWith("/admin")) return "Loading admin panel";
  return "Loading page";
}

export default function PageLoading({
  label = "Loading page",
  inline = false,
  delayMs = 150,
}: {
  label?: string;
  inline?: boolean;
  delayMs?: number;
}) {
  const [show, setShow] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return;
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  const message = (
    <div
      className="flex items-center gap-2 text-sm font-medium text-foreground/80"
      role="status"
      aria-live="polite"
      style={{ opacity: show ? 1 : 0, transition: "opacity 0.2s ease" }}
    >
      <svg
        className="animate-spin shrink-0"
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span>
        {label}
        <span className="pl-dots" aria-hidden="true">
          <i>.</i><i>.</i><i>.</i>
        </span>
      </span>
      <style>{`
        .pl-dots i { font-style: normal; animation: pl-dot 1.2s infinite both; }
        .pl-dots i:nth-child(2) { animation-delay: 0.2s; }
        .pl-dots i:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pl-dot { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .pl-dots i { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );

  if (inline) {
    return <div className="flex justify-center py-3">{message}</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      {message}
    </div>
  );
}

/** Suspense fallback for lazy route chunks — label follows the destination route. */
export function RouteLoadingFallback() {
  const [path] = useLocation();
  return <PageLoading label={routeLabel(path)} />;
}
