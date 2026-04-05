/**
 * LaunchBanner (CountdownBanner) — top-of-page ribbon.
 *
 * Reads three settings from the DB:
 *   launch_banner_enabled  — legacy toggle (kept for compatibility)
 *   countdown_enabled      — shows countdown mode when true
 *   free_until             — ISO date: countdown target / auto-lock date
 *
 * Modes:
 *   1. countdown_enabled=true + free_until set  → live countdown timer
 *   2. launch_banner_enabled=true               → original launch text (no timer)
 *   3. Neither                                  → hidden
 */

import { useState, useEffect, useRef } from "react";
import { X, Sparkles, Clock } from "lucide-react";
import { Link } from "wouter";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0d 0h 0m 0s";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
  return `${h}h ${m}m ${s}s`;
}

export default function LaunchBanner() {
  const [launchEnabled, setLaunchEnabled] = useState<boolean | null>(null);
  const [countdownEnabled, setCountdownEnabled] = useState(false);
  const [freeUntil, setFreeUntil] = useState<Date | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const [launchRes, cdRes, fuRes] = await Promise.all([
          fetch(`${RAILWAY_URL}/api/settings/launch_banner_enabled`),
          fetch(`${RAILWAY_URL}/api/settings/countdown_enabled`),
          fetch(`${RAILWAY_URL}/api/settings/free_until`),
        ]);
        const launchData = await launchRes.json();
        const cdData = await cdRes.json();
        const fuData = await fuRes.json();

        setLaunchEnabled(launchData.value !== "false");
        setCountdownEnabled(cdData.value === "true");
        if (fuData.value) {
          const d = new Date(fuData.value);
          if (!isNaN(d.getTime())) setFreeUntil(d);
        }
      } catch {
        setLaunchEnabled(true);
      }
    }
    loadSettings();
  }, []);

  // Tick the countdown every second
  useEffect(() => {
    if (!countdownEnabled || !freeUntil) return;
    const tick = () => setTimeLeft(Math.max(0, freeUntil.getTime() - Date.now()));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdownEnabled, freeUntil]);

  if (launchEnabled === null || dismissed) return null;

  const showCountdown = countdownEnabled && freeUntil && freeUntil > new Date();
  const showLaunch = !showCountdown && launchEnabled;
  if (!showCountdown && !showLaunch) return null;

  const freeUntilFormatted = freeUntil
    ? freeUntil.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div
      className="relative flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium"
      style={{
        // Amber/yellow — high contrast against the red navbar, industry standard
        // for limited-time announcement banners (Spotify, Linear, Vercel)
        background: "#F59E0B",
        color: "#1C1917",  // near-black text on amber = ~8:1 contrast ratio (WCAG AAA)
        minHeight: "36px",
      }}
    >
      {/* Shimmer sweep — subtle gold highlight */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.20) 50%, transparent 80%)",
          backgroundSize: "200% 100%",
          animation: "bannerShimmer 4s infinite linear",
        }}
      />

      {showCountdown ? (
        <>
          <Clock size={12} className="shrink-0 relative" style={{ opacity: 0.75 }} />
          <span className="text-center leading-snug relative">
            <span className="font-semibold">Free access ends in </span>
            <span
              className="font-black tracking-wide px-1.5 py-0.5 rounded"
              style={{ background: "rgba(0,0,0,0.12)", color: "#1C1917" }}
            >
              {formatCountdown(timeLeft)}
            </span>
            {freeUntilFormatted && (
              <span className="ml-1.5" style={{ opacity: 0.75 }}>— free until {freeUntilFormatted}</span>
            )}
            <Link href="/subscriptions">
              <a
                className="ml-2 font-bold hover:opacity-80 relative"
                style={{
                  background: "rgba(0,0,0,0.12)",
                  padding: "1px 8px",
                  borderRadius: "4px",
                  textDecoration: "none",
                  border: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                View plans →
              </a>
            </Link>
          </span>
        </>
      ) : (
        <>
          <Sparkles size={12} className="shrink-0 relative" style={{ opacity: 0.75 }} />
          <span className="text-center leading-snug relative">
            <span className="font-semibold">Free during launch</span>
            <span className="mx-1" style={{ opacity: 0.6 }}>—</span>
            <span style={{ opacity: 0.85 }}>
              Albania Audio Tours is currently free as we launch. A subscription plan will follow — early explorers enjoy full access now.
            </span>
          </span>
        </>
      )}

      <button
        onClick={() => setDismissed(true)}
        className="ml-1 shrink-0 opacity-50 hover:opacity-100 transition-opacity relative"
        aria-label="Dismiss announcement"
      >
        <X size={13} />
      </button>

      <style>{`
        @keyframes bannerShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
