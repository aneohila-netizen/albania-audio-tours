/**
 * LaunchBanner — slim top-of-page announcement bar.
 * Visibility is controlled via Admin → Settings → Launch Banner toggle.
 * The state is stored in the DB (app_settings table) so it persists across deploys.
 * Falls back to visible if the API is unreachable, ensuring new deploys always show it.
 */

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

export default function LaunchBanner() {
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = loading
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch(`${RAILWAY_URL}/api/settings/launch_banner_enabled`)
      .then(r => r.json())
      .then(({ value }: { value: string | null }) => {
        // Default true if key missing; false only when explicitly set to "false"
        setEnabled(value !== "false");
      })
      .catch(() => setEnabled(true)); // fail-open: show banner if API is down
  }, []);

  // Don't render until we know the state, or if dismissed this session, or turned off
  if (enabled === null || !enabled || dismissed) return null;

  return (
    <div
      className="relative flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white"
      style={{
        background: "linear-gradient(90deg, #1a1a2e 0%, #c0392b 50%, #1a1a2e 100%)",
        minHeight: "36px",
      }}
    >
      {/* Shimmer sweep */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.12) 50%, transparent 80%)",
          backgroundSize: "200% 100%",
          animation: "bannerShimmer 4s infinite linear",
        }}
      />

      <Sparkles size={12} className="shrink-0 opacity-80" />

      <span className="text-center leading-snug relative">
        <span className="font-semibold">Free during launch</span>
        <span className="opacity-70 mx-1">—</span>
        <span className="opacity-90">
          Albania Audio Tours is currently free as we launch. A subscription plan will follow — early explorers enjoy full access now.
        </span>
      </span>

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
